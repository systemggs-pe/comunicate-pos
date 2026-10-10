-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'DELETING');

-- CreateEnum
CREATE TYPE "EvidenceCategory" AS ENUM ('DNI_FRONT', 'DNI_BACK', 'DEVICE_BOX', 'PURCHASE_RECEIPT', 'LOGICAL_IMEI');

-- CreateTable
CREATE TABLE "EvidenceAsset" (
    "id" UUID NOT NULL,
    "storageKey" VARCHAR(200) NOT NULL,
    "stagingKey" VARCHAR(200),
    "mimeType" VARCHAR(30) NOT NULL DEFAULT 'image/webp',
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "checksum" VARCHAR(64),
    "width" INTEGER,
    "height" INTEGER,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdById" UUID,
    "ownerSessionId" UUID,
    "operationKey" UUID,
    "sourceRequestId" UUID,
    "category" "EvidenceCategory" NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "expectedMimeType" VARCHAR(30) NOT NULL,
    "expectedSize" INTEGER NOT NULL,
    "expectedChecksum" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "uploadExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "verifiedAt" TIMESTAMPTZ(3),
    "verificationStartedAt" TIMESTAMPTZ(3),
    "deleteAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastDeleteErrorCode" VARCHAR(40),

    CONSTRAINT "EvidenceAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationEvidence" (
    "id" UUID NOT NULL,
    "registrationRequestId" UUID NOT NULL,
    "evidenceAssetId" UUID NOT NULL,
    "category" "EvidenceCategory" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID,

    CONSTRAINT "RegistrationEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceAsset_storageKey_key" ON "EvidenceAsset"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceAsset_stagingKey_key" ON "EvidenceAsset"("stagingKey");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceAsset_idempotencyKey_key" ON "EvidenceAsset"("idempotencyKey");

-- CreateIndex
CREATE INDEX "EvidenceAsset_status_expiresAt_idx" ON "EvidenceAsset"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "EvidenceAsset_ownerSessionId_status_idx" ON "EvidenceAsset"("ownerSessionId", "status");

-- CreateIndex
CREATE INDEX "RegistrationEvidence_evidenceAssetId_idx" ON "RegistrationEvidence"("evidenceAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationEvidence_registrationRequestId_category_key" ON "RegistrationEvidence"("registrationRequestId", "category");

-- AddForeignKey
ALTER TABLE "EvidenceAsset" ADD CONSTRAINT "EvidenceAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceAsset" ADD CONSTRAINT "EvidenceAsset_ownerSessionId_fkey" FOREIGN KEY ("ownerSessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationEvidence" ADD CONSTRAINT "RegistrationEvidence_registrationRequestId_fkey" FOREIGN KEY ("registrationRequestId") REFERENCES "RegistrationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationEvidence" ADD CONSTRAINT "RegistrationEvidence_evidenceAssetId_fkey" FOREIGN KEY ("evidenceAssetId") REFERENCES "EvidenceAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationEvidence" ADD CONSTRAINT "RegistrationEvidence_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Storage metadata only; no documentary identities or binary payloads.
ALTER TABLE "EvidenceAsset" ADD CONSTRAINT evidence_sizes CHECK ("expectedSize" BETWEEN 1 AND 10485760 AND "fileSize" BETWEEN 0 AND 10485760);
ALTER TABLE "EvidenceAsset" ADD CONSTRAINT evidence_checksums CHECK ("expectedChecksum" ~ '^[a-f0-9]{64}$' AND ("checksum" IS NULL OR "checksum" ~ '^[a-f0-9]{64}$'));
ALTER TABLE "EvidenceAsset" ADD CONSTRAINT evidence_scope CHECK (("operationKey" IS NULL) <> ("sourceRequestId" IS NULL));
ALTER TABLE "EvidenceAsset" ADD CONSTRAINT evidence_ready CHECK ("status" <> 'READY' OR ("verifiedAt" IS NOT NULL AND "fileSize" > 0 AND "checksum" IS NOT NULL AND "width" >= 32 AND "height" >= 32));

-- Lock an asset before linking/detaching. This serializes last-reference deletion
-- against new references, including direct SQL outside the service layer.
CREATE FUNCTION guard_evidence_link() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE asset "EvidenceAsset"%ROWTYPE; other_equipment UUID; current_equipment UUID;
BEGIN
 SELECT * INTO asset FROM "EvidenceAsset" WHERE id=NEW."evidenceAssetId" FOR UPDATE;
 IF asset."status" <> 'READY' OR asset."category" <> NEW."category" THEN RAISE EXCEPTION 'Evidence must be READY and match category' USING ERRCODE='23514'; END IF;
 IF NEW."category"='LOGICAL_IMEI' AND EXISTS(SELECT 1 FROM "RegistrationEvidence" WHERE "evidenceAssetId"=asset.id AND id<>NEW.id) THEN RAISE EXCEPTION 'Logical IMEI evidence cannot be shared' USING ERRCODE='23514'; END IF;
 SELECT i."equipmentId" INTO current_equipment FROM "RegistrationRequest" r JOIN "Imei" i ON i.id=r."imeiId" WHERE r.id=NEW."registrationRequestId";
 SELECT i."equipmentId" INTO other_equipment FROM "RegistrationEvidence" e JOIN "RegistrationRequest" r ON r.id=e."registrationRequestId" JOIN "Imei" i ON i.id=r."imeiId" WHERE e."evidenceAssetId"=asset.id AND e.id<>NEW.id LIMIT 1;
 IF other_equipment IS NOT NULL AND other_equipment<>current_equipment THEN RAISE EXCEPTION 'Cannot share evidence across equipment' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER evidence_link_guard BEFORE INSERT OR UPDATE ON "RegistrationEvidence" FOR EACH ROW EXECUTE FUNCTION guard_evidence_link();
CREATE FUNCTION retire_unreferenced_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM id FROM "EvidenceAsset" WHERE id=OLD."evidenceAssetId" FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM "RegistrationEvidence" WHERE "evidenceAssetId"=OLD."evidenceAssetId") THEN UPDATE "EvidenceAsset" SET status='DELETING',"updatedAt"=now() WHERE id=OLD."evidenceAssetId"; END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER evidence_last_reference AFTER DELETE ON "RegistrationEvidence" FOR EACH ROW EXECUTE FUNCTION retire_unreferenced_evidence();
CREATE FUNCTION protect_referenced_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.status<>'READY' OR NEW."storageKey"<>OLD."storageKey" OR NEW."checksum" IS DISTINCT FROM OLD."checksum" OR NEW."category"<>OLD."category") AND EXISTS(SELECT 1 FROM "RegistrationEvidence" WHERE "evidenceAssetId"=OLD.id) THEN RAISE EXCEPTION 'Referenced evidence is immutable and READY' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER evidence_asset_guard BEFORE UPDATE ON "EvidenceAsset" FOR EACH ROW EXECUTE FUNCTION protect_referenced_evidence();
INSERT INTO "Permission"(key) VALUES ('registration.evidence.read'),('registration.evidence.upload'),('registration.evidence.replace'),('registration.evidence.delete');
INSERT INTO "RolePermission"("roleId","permissionKey") SELECT id,p.key FROM "Role", "Permission" p WHERE "Role".code='SUPERADMIN' AND p.key LIKE 'registration.evidence.%';
