-- Preserve operation/request scopes and add the explicit client-only identity scope.
ALTER TABLE "EvidenceAsset" DROP CONSTRAINT evidence_scope;
ALTER TABLE "EvidenceAsset" ADD CONSTRAINT evidence_scope CHECK (
 (("operationKey" IS NULL) <> ("sourceRequestId" IS NULL)) OR
 ("operationKey" IS NULL AND "sourceRequestId" IS NULL AND "ownerClientId" IS NOT NULL
  AND category::text IN ('DNI_FRONT','DNI_BACK','IDENTITY_IMAGE'))
);
ALTER TABLE "EvidenceAsset" ADD CONSTRAINT evidence_client_identity_category CHECK (
 "ownerClientId" IS NULL OR category::text IN ('DNI_FRONT','DNI_BACK','IDENTITY_IMAGE')
);
CREATE OR REPLACE FUNCTION protect_evidence_dimensions() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.width IS DISTINCT FROM OLD.width OR NEW.height IS DISTINCT FROM OLD.height OR NEW."fileSize"<>OLD."fileSize" OR NEW."mimeType"<>OLD."mimeType" OR NEW."verifiedAt" IS DISTINCT FROM OLD."verifiedAt" OR NEW."operationKey" IS DISTINCT FROM OLD."operationKey" OR NEW."sourceRequestId" IS DISTINCT FROM OLD."sourceRequestId")
 AND (EXISTS(SELECT 1 FROM "RegistrationEvidence" WHERE "evidenceAssetId"=OLD.id) OR EXISTS(SELECT 1 FROM "ClientDocument" WHERE "evidenceAssetId"=OLD.id)) THEN
  RAISE EXCEPTION 'Referenced evidence metadata is immutable' USING ERRCODE='23514';
 END IF;RETURN NEW;
END $$;
