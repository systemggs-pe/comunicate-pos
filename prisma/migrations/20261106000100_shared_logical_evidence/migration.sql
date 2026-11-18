-- Share a screen photo between IMEIs of the same device. Preserve all identity,
-- category, lifecycle, equipment and operation scope checks. Existing rows unchanged.
BEGIN;
CREATE OR REPLACE FUNCTION guard_evidence_link() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE asset "EvidenceAsset"%ROWTYPE; other_equipment UUID; current_equipment UUID; reusable boolean;
BEGIN
 SELECT * INTO asset FROM "EvidenceAsset" WHERE id=NEW."evidenceAssetId" FOR UPDATE;
 reusable:=client_identity_reference(asset.id,NEW."registrationRequestId",NEW.category);
 IF asset.status<>'READY' OR (asset.category<>NEW.category AND NOT reusable) THEN RAISE EXCEPTION 'Evidence category/status mismatch' USING ERRCODE='23514';END IF;
 SELECT i."equipmentId" INTO current_equipment FROM "RegistrationRequest" r JOIN "Imei" i ON i.id=r."imeiId" WHERE r.id=NEW."registrationRequestId";
 SELECT i."equipmentId" INTO other_equipment FROM "RegistrationEvidence" e JOIN "RegistrationRequest" r ON r.id=e."registrationRequestId" JOIN "Imei" i ON i.id=r."imeiId" WHERE e."evidenceAssetId"=asset.id AND e.id<>NEW.id LIMIT 1;
 IF other_equipment IS NOT NULL AND other_equipment<>current_equipment AND NOT reusable THEN RAISE EXCEPTION 'Cannot share device evidence' USING ERRCODE='23514';END IF;RETURN NEW;
END $$;
COMMIT;
