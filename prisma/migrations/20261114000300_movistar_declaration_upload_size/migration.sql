BEGIN;
ALTER TABLE "EvidenceAsset"
 DROP CONSTRAINT evidence_sizes,
 DROP CONSTRAINT evidence_expected_type,
 DROP CONSTRAINT evidence_ready,
 ADD CONSTRAINT evidence_sizes CHECK (
  "expectedSize" >= 1 AND "fileSize" >= 0 AND (
   category='MOVISTAR_DECLARATION' OR ("expectedSize"<=10485760 AND "fileSize"<=10485760)
  )
 ),
 ADD CONSTRAINT evidence_expected_type CHECK (
  (category='MOVISTAR_DECLARATION' AND "expectedMimeType"='application/pdf'
   AND "operationKey" IS NOT NULL AND "originalStorageKey" IS NULL)
  OR (category<>'MOVISTAR_DECLARATION' AND (
   "expectedMimeType" IN ('image/jpeg','image/png','image/webp')
   OR ("expectedMimeType"='application/pdf' AND category='PURCHASE_RECEIPT' AND "originalStorageKey" IS NOT NULL)
  ))
 ),
 ADD CONSTRAINT evidence_ready CHECK (status<>'READY' OR (
  "verifiedAt" IS NOT NULL AND "fileSize">0 AND checksum IS NOT NULL AND (
   (category='MOVISTAR_DECLARATION' AND "mimeType"='application/pdf'
    AND "fileSize"="expectedSize" AND checksum="expectedChecksum" AND width IS NULL AND height IS NULL)
   OR (category<>'MOVISTAR_DECLARATION' AND width IS NOT NULL AND height IS NOT NULL
    AND width BETWEEN 32 AND 12000 AND height BETWEEN 32 AND 12000 AND width::bigint*height<=20000000)
  )
 ));
COMMIT;
