BEGIN;
-- AlterTable
ALTER TABLE "EvidenceAsset" ADD COLUMN     "originalChecksum" VARCHAR(64),
ADD COLUMN     "originalFileSize" INTEGER,
ADD COLUMN     "originalStorageKey" VARCHAR(200),
ADD COLUMN     "receiptPage" INTEGER;

-- CreateTable
CREATE TABLE "EquipmentReceiptEvidence" (
    "equipmentId" UUID NOT NULL,
    "evidenceAssetId" UUID NOT NULL,
    "foreignReceiptId" UUID,
    "version" TIMESTAMPTZ(3),

    CONSTRAINT "EquipmentReceiptEvidence_pkey" PRIMARY KEY ("equipmentId","evidenceAssetId")
);

-- CreateIndex
CREATE INDEX "EquipmentReceiptEvidence_evidenceAssetId_idx" ON "EquipmentReceiptEvidence"("evidenceAssetId");

-- CreateIndex
CREATE INDEX "EquipmentReceiptEvidence_equipmentId_foreignReceiptId_versi_idx" ON "EquipmentReceiptEvidence"("equipmentId", "foreignReceiptId", "version");

-- CreateIndex
CREATE INDEX "EquipmentReceiptEvidence_foreignReceiptId_idx" ON "EquipmentReceiptEvidence"("foreignReceiptId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceAsset_originalStorageKey_key" ON "EvidenceAsset"("originalStorageKey");

-- AddForeignKey
ALTER TABLE "EquipmentReceiptEvidence" ADD CONSTRAINT "EquipmentReceiptEvidence_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentReceiptEvidence" ADD CONSTRAINT "EquipmentReceiptEvidence_evidenceAssetId_fkey" FOREIGN KEY ("evidenceAssetId") REFERENCES "EvidenceAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentReceiptEvidence" ADD CONSTRAINT "EquipmentReceiptEvidence_foreignReceiptId_fkey" FOREIGN KEY ("foreignReceiptId") REFERENCES "ForeignReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;


CREATE OR REPLACE FUNCTION evidence_link_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE asset "EvidenceAsset"%ROWTYPE; request_operation UUID;
BEGIN
 SELECT * INTO asset FROM "EvidenceAsset" WHERE id=NEW."evidenceAssetId" FOR UPDATE;
 IF client_identity_reference(asset.id,NEW."registrationRequestId",NEW.category) THEN RETURN NEW;END IF;
 IF NEW.category = 'PURCHASE_RECEIPT' AND EXISTS(
  SELECT 1 FROM "EquipmentReceiptEvidence" d JOIN "RegistrationRequest" r ON r.id=NEW."registrationRequestId"
  JOIN "Imei" i ON i.id=r."imeiId" AND i."equipmentId"=d."equipmentId"
  WHERE d."evidenceAssetId"=asset.id
 ) THEN RETURN NEW;END IF;
 SELECT o."idempotencyKey" INTO request_operation FROM "RegistrationRequest" r JOIN "RegistrationOperation" o ON r."operationId"=o.id WHERE r.id=NEW."registrationRequestId";
 IF (asset."sourceRequestId" IS NOT NULL AND asset."sourceRequestId"<>NEW."registrationRequestId") OR (asset."operationKey" IS NOT NULL AND asset."operationKey"<>request_operation) THEN RAISE EXCEPTION 'Evidence scope mismatch' USING ERRCODE='23514';END IF;RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION retire_unreferenced_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM id FROM "EvidenceAsset" WHERE id=OLD."evidenceAssetId" FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM "RegistrationEvidence" WHERE "evidenceAssetId"=OLD."evidenceAssetId") AND NOT EXISTS(SELECT 1 FROM "ClientDocument" WHERE "evidenceAssetId"=OLD."evidenceAssetId") AND NOT EXISTS(SELECT 1 FROM "EquipmentReceiptEvidence" WHERE "evidenceAssetId"=OLD."evidenceAssetId") THEN UPDATE "EvidenceAsset" SET status='DELETING',"updatedAt"=now() WHERE id=OLD."evidenceAssetId";END IF;RETURN OLD;
END $$;
CREATE OR REPLACE FUNCTION protect_referenced_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.status<>'READY' OR NEW."storageKey"<>OLD."storageKey" OR NEW.checksum IS DISTINCT FROM OLD.checksum OR NEW.category<>OLD.category OR NEW."ownerClientId" IS DISTINCT FROM OLD."ownerClientId" OR NEW."originalStorageKey" IS DISTINCT FROM OLD."originalStorageKey" OR NEW."originalFileSize" IS DISTINCT FROM OLD."originalFileSize" OR NEW."originalChecksum" IS DISTINCT FROM OLD."originalChecksum" OR NEW."receiptPage" IS DISTINCT FROM OLD."receiptPage") AND (EXISTS(SELECT 1 FROM "RegistrationEvidence" WHERE "evidenceAssetId"=OLD.id) OR EXISTS(SELECT 1 FROM "ClientDocument" WHERE "evidenceAssetId"=OLD.id) OR EXISTS(SELECT 1 FROM "EquipmentReceiptEvidence" WHERE "evidenceAssetId"=OLD.id)) THEN
 IF NOT(OLD."ownerClientId" IS NULL AND NEW."ownerClientId" IS NOT NULL AND NEW.status=OLD.status AND NEW."storageKey"=OLD."storageKey" AND NEW.checksum IS NOT DISTINCT FROM OLD.checksum AND NEW.category=OLD.category AND NEW."originalStorageKey" IS NOT DISTINCT FROM OLD."originalStorageKey" AND NEW."originalFileSize" IS NOT DISTINCT FROM OLD."originalFileSize" AND NEW."originalChecksum" IS NOT DISTINCT FROM OLD."originalChecksum" AND NEW."receiptPage" IS NOT DISTINCT FROM OLD."receiptPage") THEN RAISE EXCEPTION 'Referenced evidence immutable' USING ERRCODE='23514';END IF;END IF;RETURN NEW;
END $$;
CREATE TRIGGER equipment_receipt_last_reference AFTER DELETE ON "EquipmentReceiptEvidence"
FOR EACH ROW EXECUTE FUNCTION retire_unreferenced_evidence();

CREATE FUNCTION guard_equipment_receipt_reference() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE asset "EvidenceAsset"%ROWTYPE;
BEGIN
 SELECT * INTO asset FROM "EvidenceAsset" WHERE id=NEW."evidenceAssetId" FOR UPDATE;
 IF asset.status IS DISTINCT FROM 'READY' OR asset.category IS DISTINCT FROM 'PURCHASE_RECEIPT' THEN
  RAISE EXCEPTION 'Receipt evidence must be ready' USING ERRCODE='23514';
 END IF;
 IF EXISTS(SELECT 1 FROM "EquipmentReceiptEvidence" d WHERE d."evidenceAssetId"=asset.id AND d."equipmentId"<>NEW."equipmentId") OR
    EXISTS(SELECT 1 FROM "RegistrationEvidence" d JOIN "RegistrationRequest" r ON r.id=d."registrationRequestId"
    JOIN "Imei" i ON i.id=r."imeiId" WHERE d."evidenceAssetId"=asset.id AND i."equipmentId"<>NEW."equipmentId") THEN
  RAISE EXCEPTION 'Receipt belongs to another device' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER equipment_receipt_reference_guard BEFORE INSERT ON "EquipmentReceiptEvidence"
FOR EACH ROW EXECUTE FUNCTION guard_equipment_receipt_reference();
COMMIT;
