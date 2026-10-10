ALTER TABLE "EvidenceAsset" ADD CONSTRAINT evidence_ready_dimensions CHECK (status<>'READY' OR (width IS NOT NULL AND height IS NOT NULL AND width BETWEEN 32 AND 12000 AND height BETWEEN 32 AND 12000 AND width::bigint*height<=20000000));
ALTER TABLE "EvidenceAsset" ADD CONSTRAINT evidence_expected_type CHECK ("expectedMimeType" IN ('image/jpeg','image/png','image/webp'));
CREATE FUNCTION prevent_evidence_link_move() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Evidence associations are immutable: delete and create for replacement' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER evidence_link_immutable BEFORE UPDATE ON "RegistrationEvidence" FOR EACH ROW EXECUTE FUNCTION prevent_evidence_link_move();
CREATE FUNCTION evidence_link_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE asset "EvidenceAsset"%ROWTYPE; request_operation UUID;
BEGIN
 SELECT * INTO asset FROM "EvidenceAsset" WHERE id=NEW."evidenceAssetId" FOR UPDATE;
 SELECT o."idempotencyKey" INTO request_operation FROM "RegistrationRequest" r JOIN "RegistrationOperation" o ON r."operationId"=o.id WHERE r.id=NEW."registrationRequestId";
 IF (asset."sourceRequestId" IS NOT NULL AND asset."sourceRequestId"<>NEW."registrationRequestId") OR (asset."operationKey" IS NOT NULL AND asset."operationKey"<>request_operation) THEN RAISE EXCEPTION 'Evidence scope does not match request' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER evidence_link_scope_guard BEFORE INSERT ON "RegistrationEvidence" FOR EACH ROW EXECUTE FUNCTION evidence_link_scope();
CREATE FUNCTION protect_evidence_dimensions() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.width IS DISTINCT FROM OLD.width OR NEW.height IS DISTINCT FROM OLD.height OR NEW."fileSize"<>OLD."fileSize" OR NEW."mimeType"<>OLD."mimeType" OR NEW."verifiedAt" IS DISTINCT FROM OLD."verifiedAt" OR NEW."operationKey" IS DISTINCT FROM OLD."operationKey" OR NEW."sourceRequestId" IS DISTINCT FROM OLD."sourceRequestId") AND EXISTS(SELECT 1 FROM "RegistrationEvidence" WHERE "evidenceAssetId"=OLD.id) THEN RAISE EXCEPTION 'Referenced evidence metadata is immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER evidence_dimensions_guard BEFORE UPDATE ON "EvidenceAsset" FOR EACH ROW EXECUTE FUNCTION protect_evidence_dimensions();
