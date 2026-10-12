DROP INDEX "ClientDocument_clientId_evidenceAssetId_key";
CREATE UNIQUE INDEX "ClientDocument_clientId_evidenceAssetId_documentType_source_key" ON "ClientDocument"("clientId","evidenceAssetId","documentType",source);
-- Client-owned assets may only acquire new registration references through a
-- current, authorized identity document for that same request owner.
CREATE FUNCTION guard_client_identity_reuse() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a "EvidenceAsset"%ROWTYPE;
BEGIN
 SELECT * INTO a FROM "EvidenceAsset" WHERE id=NEW."evidenceAssetId" FOR UPDATE;
 IF a."ownerClientId" IS NOT NULL AND NOT client_identity_reference(a.id,NEW."registrationRequestId",NEW.category) THEN RAISE EXCEPTION 'Current identity authorization required' USING ERRCODE='23514';END IF;RETURN NEW;
END $$;
CREATE TRIGGER client_identity_reuse_guard BEFORE INSERT ON "RegistrationEvidence" FOR EACH ROW EXECUTE FUNCTION guard_client_identity_reuse();
