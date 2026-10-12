ALTER TYPE "EvidenceCategory" ADD VALUE 'IDENTITY_IMAGE';
ALTER TABLE "EvidenceAsset" ADD COLUMN "ownerClientId" UUID REFERENCES "Client"(id) ON DELETE RESTRICT;
CREATE TABLE "ClientDocument" (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),"clientId" UUID NOT NULL REFERENCES "Client"(id) ON DELETE RESTRICT,
 "evidenceAssetId" UUID NOT NULL REFERENCES "EvidenceAsset"(id) ON DELETE RESTRICT,
 category VARCHAR(30) NOT NULL CHECK(category IN ('DNI_FRONT','DNI_BACK','IDENTITY_IMAGE')),
 "documentType" VARCHAR(20) NOT NULL CHECK("documentType" IN ('BLUE','ELECTRONIC','MANUAL')),
 source VARCHAR(30) NOT NULL CHECK(source IN ('MANUAL_UPLOAD','CODART_DNIV','CODART_DNIVEL','REGISTRATION_EVIDENCE')),
 "sourceOrdinal" INTEGER CHECK("sourceOrdinal" BETWEEN 1 AND 4),status VARCHAR(20) NOT NULL DEFAULT 'CURRENT' CHECK(status IN ('CURRENT','REPLACED','REVIEW')),
 purpose VARCHAR(200) NOT NULL CHECK(length(trim(purpose))>0),"authorizationReference" VARCHAR(200) NOT NULL CHECK(length(trim("authorizationReference"))>0),
 "expiresAt" TIMESTAMPTZ(3) NOT NULL,"createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),"updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
 "createdById" UUID REFERENCES "User"(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX "ClientDocument_clientId_evidenceAssetId_key" ON "ClientDocument"("clientId","evidenceAssetId");
CREATE INDEX "ClientDocument_clientId_status_documentType_idx" ON "ClientDocument"("clientId",status,"documentType");
CREATE INDEX "ClientDocument_evidenceAssetId_idx" ON "ClientDocument"("evidenceAssetId");
CREATE FUNCTION client_identity_reference(asset_id UUID,request_id UUID,cat "EvidenceCategory") RETURNS boolean LANGUAGE sql AS $$
 SELECT EXISTS(SELECT 1 FROM "ClientDocument" d JOIN "RegistrationRequest" r ON r.id=request_id JOIN "Imei" i ON i.id=r."imeiId" JOIN "Equipment" e ON e.id=i."equipmentId" WHERE d."evidenceAssetId"=asset_id AND d."clientId"=e."ownerId" AND d.category=cat::text AND d.status='CURRENT' AND d."expiresAt">now() AND cat::text IN ('DNI_FRONT','DNI_BACK'))
$$;
CREATE OR REPLACE FUNCTION guard_evidence_link() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE asset "EvidenceAsset"%ROWTYPE; other_equipment UUID; current_equipment UUID; reusable boolean;
BEGIN
 SELECT * INTO asset FROM "EvidenceAsset" WHERE id=NEW."evidenceAssetId" FOR UPDATE;
 reusable:=client_identity_reference(asset.id,NEW."registrationRequestId",NEW.category);
 IF asset.status<>'READY' OR (asset.category<>NEW.category AND NOT reusable) THEN RAISE EXCEPTION 'Evidence category/status mismatch' USING ERRCODE='23514';END IF;
 IF NEW.category='LOGICAL_IMEI' AND EXISTS(SELECT 1 FROM "RegistrationEvidence" WHERE "evidenceAssetId"=asset.id) THEN RAISE EXCEPTION 'Logical evidence cannot be shared' USING ERRCODE='23514';END IF;
 SELECT i."equipmentId" INTO current_equipment FROM "RegistrationRequest" r JOIN "Imei" i ON i.id=r."imeiId" WHERE r.id=NEW."registrationRequestId";
 SELECT i."equipmentId" INTO other_equipment FROM "RegistrationEvidence" e JOIN "RegistrationRequest" r ON r.id=e."registrationRequestId" JOIN "Imei" i ON i.id=r."imeiId" WHERE e."evidenceAssetId"=asset.id AND e.id<>NEW.id LIMIT 1;
 IF other_equipment IS NOT NULL AND other_equipment<>current_equipment AND NOT reusable THEN RAISE EXCEPTION 'Cannot share device evidence' USING ERRCODE='23514';END IF;RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION evidence_link_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE asset "EvidenceAsset"%ROWTYPE; request_operation UUID;
BEGIN
 SELECT * INTO asset FROM "EvidenceAsset" WHERE id=NEW."evidenceAssetId" FOR UPDATE;
 IF client_identity_reference(asset.id,NEW."registrationRequestId",NEW.category) THEN RETURN NEW;END IF;
 SELECT o."idempotencyKey" INTO request_operation FROM "RegistrationRequest" r JOIN "RegistrationOperation" o ON r."operationId"=o.id WHERE r.id=NEW."registrationRequestId";
 IF (asset."sourceRequestId" IS NOT NULL AND asset."sourceRequestId"<>NEW."registrationRequestId") OR (asset."operationKey" IS NOT NULL AND asset."operationKey"<>request_operation) THEN RAISE EXCEPTION 'Evidence scope mismatch' USING ERRCODE='23514';END IF;RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION retire_unreferenced_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM id FROM "EvidenceAsset" WHERE id=OLD."evidenceAssetId" FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM "RegistrationEvidence" WHERE "evidenceAssetId"=OLD."evidenceAssetId") AND NOT EXISTS(SELECT 1 FROM "ClientDocument" WHERE "evidenceAssetId"=OLD."evidenceAssetId") THEN UPDATE "EvidenceAsset" SET status='DELETING',"updatedAt"=now() WHERE id=OLD."evidenceAssetId";END IF;RETURN OLD;
END $$;
CREATE TRIGGER client_document_last_reference AFTER DELETE ON "ClientDocument" FOR EACH ROW EXECUTE FUNCTION retire_unreferenced_evidence();
CREATE OR REPLACE FUNCTION protect_referenced_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.status<>'READY' OR NEW."storageKey"<>OLD."storageKey" OR NEW.checksum IS DISTINCT FROM OLD.checksum OR NEW.category<>OLD.category OR NEW."ownerClientId" IS DISTINCT FROM OLD."ownerClientId") AND (EXISTS(SELECT 1 FROM "RegistrationEvidence" WHERE "evidenceAssetId"=OLD.id) OR EXISTS(SELECT 1 FROM "ClientDocument" WHERE "evidenceAssetId"=OLD.id)) THEN
 IF NOT(OLD."ownerClientId" IS NULL AND NEW."ownerClientId" IS NOT NULL AND NEW.status=OLD.status AND NEW."storageKey"=OLD."storageKey" AND NEW.checksum IS NOT DISTINCT FROM OLD.checksum AND NEW.category=OLD.category) THEN RAISE EXCEPTION 'Referenced evidence immutable' USING ERRCODE='23514';END IF;END IF;RETURN NEW;
END $$;
CREATE FUNCTION guard_client_document() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a "EvidenceAsset"%ROWTYPE;
BEGIN
 SELECT * INTO a FROM "EvidenceAsset" WHERE id=NEW."evidenceAssetId" FOR UPDATE;
 IF a.status<>'READY' OR a.category::text NOT IN ('DNI_FRONT','DNI_BACK','IDENTITY_IMAGE') OR (a."ownerClientId" IS NOT NULL AND a."ownerClientId"<>NEW."clientId") THEN RAISE EXCEPTION 'Identity owner mismatch' USING ERRCODE='23514';END IF;
 IF TG_OP='UPDATE' AND (NEW."clientId"<>OLD."clientId" OR NEW."evidenceAssetId"<>OLD."evidenceAssetId" OR NEW.source<>OLD.source OR NEW."sourceOrdinal" IS DISTINCT FROM OLD."sourceOrdinal") THEN RAISE EXCEPTION 'Document provenance immutable' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM "RegistrationEvidence" l JOIN "RegistrationRequest" r ON r.id=l."registrationRequestId" JOIN "Imei" i ON i.id=r."imeiId" JOIN "Equipment" e ON e.id=i."equipmentId" WHERE l."evidenceAssetId"=a.id AND e."ownerId" IS DISTINCT FROM NEW."clientId") THEN RAISE EXCEPTION 'Identity historical owner mismatch' USING ERRCODE='23514';END IF;
 UPDATE "EvidenceAsset" SET "ownerClientId"=NEW."clientId" WHERE id=a.id AND "ownerClientId" IS NULL;RETURN NEW;
END $$;
CREATE TRIGGER client_document_guard BEFORE INSERT OR UPDATE ON "ClientDocument" FOR EACH ROW EXECUTE FUNCTION guard_client_document();
-- Additive historical associations only. Changed/ambiguous ownership is left for review.
INSERT INTO "ClientDocument"("clientId","evidenceAssetId",category,"documentType",source,status,purpose,"authorizationReference","expiresAt","createdById")
SELECT e."ownerId",a.id,a.category::text,'MANUAL','REGISTRATION_EVIDENCE','REVIEW','REGISTRATION_HISTORY','LEGACY_REGISTRATION_LINK',now()+interval '365 days',a."createdById"
FROM "EvidenceAsset" a JOIN "RegistrationEvidence" l ON l."evidenceAssetId"=a.id JOIN "RegistrationRequest" r ON r.id=l."registrationRequestId" JOIN "Imei" i ON i.id=r."imeiId" JOIN "Equipment" e ON e.id=i."equipmentId"
WHERE a.status='READY' AND a.category::text IN ('DNI_FRONT','DNI_BACK') AND e."ownerId" IS NOT NULL
AND NOT EXISTS(SELECT 1 FROM "RegistrationEvidence" l2 JOIN "RegistrationRequest" r2 ON r2.id=l2."registrationRequestId" JOIN "Imei" i2 ON i2.id=r2."imeiId" JOIN "Equipment" e2 ON e2.id=i2."equipmentId" WHERE l2."evidenceAssetId"=a.id AND (e2."ownerId" IS DISTINCT FROM e."ownerId" OR EXISTS(SELECT 1 FROM "EquipmentHistory" h WHERE h."equipmentId"=e2.id AND h."eventType"='OWNER_CHANGED')))
GROUP BY e."ownerId",a.id ON CONFLICT DO NOTHING;
INSERT INTO "Permission"(key) VALUES ('client.documents.read'),('client.documents.upload'),('client.documents.replace'),('client.documents.delete'),('client.identity_photo.lookup');
INSERT INTO "RolePermission"("roleId","permissionKey") SELECT r.id,p.key FROM "Role" r CROSS JOIN "Permission" p WHERE r.code='SUPERADMIN' AND p.key LIKE 'client.%';
