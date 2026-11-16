BEGIN;
ALTER TABLE "EvidenceAsset" DROP CONSTRAINT evidence_expected_type;
ALTER TABLE "EvidenceAsset"
 ADD CONSTRAINT evidence_expected_type CHECK (
  "expectedMimeType" IN ('image/jpeg','image/png','image/webp')
  OR ("expectedMimeType"='application/pdf' AND category='PURCHASE_RECEIPT' AND "originalStorageKey" IS NOT NULL)
 ),
 ADD CONSTRAINT evidence_receipt_original CHECK (
  "originalStorageKey" IS NULL OR (
   category='PURCHASE_RECEIPT' AND
   (status<>'READY' OR (
    "originalFileSize" BETWEEN 1 AND 10485760 AND "originalFileSize" IS NOT NULL
    AND "originalChecksum" ~ '^[a-f0-9]{64}$' AND "originalChecksum" IS NOT NULL
    AND "receiptPage" BETWEEN 1 AND 30 AND "receiptPage" IS NOT NULL
   ))
  )
 );
COMMIT;
