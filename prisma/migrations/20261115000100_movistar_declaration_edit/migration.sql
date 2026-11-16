ALTER TABLE "EvidenceAsset"
 DROP CONSTRAINT evidence_expected_type,
 ADD CONSTRAINT evidence_expected_type CHECK (
  (category='MOVISTAR_DECLARATION' AND "expectedMimeType"='application/pdf'
   AND (("operationKey" IS NULL) <> ("sourceRequestId" IS NULL)) AND "originalStorageKey" IS NULL)
  OR (category<>'MOVISTAR_DECLARATION' AND (
   "expectedMimeType" IN ('image/jpeg','image/png','image/webp')
   OR ("expectedMimeType"='application/pdf' AND category='PURCHASE_RECEIPT' AND "originalStorageKey" IS NOT NULL)
  ))
 );
