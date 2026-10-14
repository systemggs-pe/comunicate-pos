CREATE UNIQUE INDEX "ClientDocument_current_identity_side_key"
 ON "ClientDocument"("clientId","documentType",category)
 WHERE status='CURRENT' AND category IN ('DNI_FRONT','DNI_BACK');
CREATE OR REPLACE FUNCTION guard_client_document() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a "EvidenceAsset"%ROWTYPE;
BEGIN
 SELECT * INTO a FROM "EvidenceAsset" WHERE id=NEW."evidenceAssetId" FOR UPDATE;
 IF a.status<>'READY' OR a.category::text NOT IN ('DNI_FRONT','DNI_BACK','IDENTITY_IMAGE') OR (a."ownerClientId" IS NOT NULL AND a."ownerClientId"<>NEW."clientId") THEN RAISE EXCEPTION 'Identity owner mismatch' USING ERRCODE='23514';END IF;
 IF a.category::text IN ('DNI_FRONT','DNI_BACK') AND NEW.category<>a.category::text THEN RAISE EXCEPTION 'Identity face mismatch' USING ERRCODE='23514';END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW."clientId"<>OLD."clientId" OR NEW."evidenceAssetId"<>OLD."evidenceAssetId" OR NEW.source<>OLD.source OR NEW."sourceOrdinal" IS DISTINCT FROM OLD."sourceOrdinal" THEN RAISE EXCEPTION 'Document provenance immutable' USING ERRCODE='23514';END IF;
  IF NEW.category<>OLD.category AND EXISTS(SELECT 1 FROM "RegistrationEvidence" WHERE "evidenceAssetId"=OLD."evidenceAssetId") THEN RAISE EXCEPTION 'Referenced identity classification immutable' USING ERRCODE='23514';END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM "RegistrationEvidence" l JOIN "RegistrationRequest" r ON r.id=l."registrationRequestId" JOIN "Imei" i ON i.id=r."imeiId" JOIN "Equipment" e ON e.id=i."equipmentId" WHERE l."evidenceAssetId"=a.id AND e."ownerId" IS DISTINCT FROM NEW."clientId") THEN RAISE EXCEPTION 'Identity historical owner mismatch' USING ERRCODE='23514';END IF;
 UPDATE "EvidenceAsset" SET "ownerClientId"=NEW."clientId" WHERE id=a.id AND "ownerClientId" IS NULL;RETURN NEW;
END $$;
