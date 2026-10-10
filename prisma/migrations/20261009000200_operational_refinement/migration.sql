BEGIN;
-- Stop rather than reinterpret old commercial/ambiguous operations.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM "Sale" WHERE status <> 'COMPLETED') THEN RAISE EXCEPTION 'REFINEMENT_REVIEW_REQUIRED: non-completed historical sales'; END IF;
 IF EXISTS(SELECT 1 FROM "SaleEquipment" GROUP BY "equipmentId" HAVING count(*)>1) THEN RAISE EXCEPTION 'REFINEMENT_REVIEW_REQUIRED: equipment shared by sales'; END IF;
 IF EXISTS(SELECT 1 FROM "Imei" WHERE "registrationStatus" IN ('PROCESSING','REJECTED','CANCELLED')) OR EXISTS(SELECT 1 FROM "RegistrationRequest" WHERE status='CANCELLED') THEN RAISE EXCEPTION 'REFINEMENT_REVIEW_REQUIRED: ambiguous historical registration'; END IF;
END $$;
DROP TRIGGER request_state_consistency ON "RegistrationRequest";
DROP TRIGGER imei_request_consistency ON "Imei";
DROP FUNCTION validate_request_imei_state();
ALTER TABLE "Client" ADD COLUMN address varchar(300), ADD COLUMN department varchar(100);
ALTER TABLE "Imei" DROP CONSTRAINT registration_dates;
ALTER TABLE "Imei" ADD COLUMN "legacyRegistrationStatus" varchar(30), ADD COLUMN "legacyRegisteredAt" timestamptz(3);
UPDATE "Imei" SET "legacyRegistrationStatus"="registrationStatus"::text,"legacyRegisteredAt"="registeredAt";
ALTER TABLE "RegistrationRequest" ADD COLUMN "legacyStatus" varchar(30);
UPDATE "RegistrationRequest" SET "legacyStatus"=status::text;
ALTER TABLE "RegistrationRequest" RENAME COLUMN conditions TO "legacyConditions";
ALTER TABLE "RegistrationRequest" ALTER COLUMN "legacyConditions" DROP NOT NULL;
ALTER TABLE "RegistrationRequest" RENAME COLUMN "blockStatus" TO "legacyBlockStatus";
ALTER TABLE "RegistrationRequest" ALTER COLUMN "legacyBlockStatus" TYPE varchar(30) USING "legacyBlockStatus"::text;
ALTER TABLE "RegistrationRequest" ALTER COLUMN "legacyBlockStatus" DROP NOT NULL;
DROP TYPE "OperationalBlockStatus";
ALTER TABLE "RegistrationRequest" DROP CONSTRAINT request_completed_date;
DROP INDEX request_one_live_per_imei;
ALTER TABLE "RegistrationRequest" ALTER COLUMN status DROP DEFAULT;
ALTER TYPE "RequestStatus" RENAME TO "RequestStatus_old";
CREATE TYPE "RequestStatus" AS ENUM ('BLOCKED','PENDING','REGISTERED');
-- Human decision on 2026-10-09: historical COMPLETED + BLOCKED becomes BLOCKED awaiting DESBLOQUEAR.
ALTER TABLE "RegistrationRequest" ALTER COLUMN status TYPE "RequestStatus" USING (CASE WHEN "legacyBlockStatus"='BLOCKED' THEN 'BLOCKED' WHEN status::text='COMPLETED' THEN 'REGISTERED' ELSE 'PENDING' END)::"RequestStatus";
DROP TYPE "RequestStatus_old";
ALTER TABLE "RegistrationRequest" ALTER COLUMN status SET DEFAULT 'PENDING';
ALTER TABLE "RegistrationRequest" ADD COLUMN "completedById" uuid REFERENCES "User"(id) ON DELETE RESTRICT;
-- Preserve prior completion metadata even when the new current state is BLOCKED.
UPDATE "RegistrationRequest" r SET "completedById"=COALESCE((SELECT "userId" FROM "RegistrationRequestHistory" h WHERE h."requestId"=r.id AND h.action='COMPLETED' ORDER BY h."createdAt" DESC LIMIT 1),r."updatedById") WHERE r."completedAt" IS NOT NULL;
ALTER TABLE "RegistrationRequest" ALTER COLUMN operator SET DEFAULT 'BITEL';
CREATE UNIQUE INDEX request_one_per_imei ON "RegistrationRequest"("imeiId");
ALTER TABLE "Imei" ALTER COLUMN "registrationStatus" DROP DEFAULT;
ALTER TABLE "Imei" ALTER COLUMN "registrationStatus" DROP NOT NULL;
ALTER TYPE "RegistrationStatus" RENAME TO "RegistrationStatus_old";
CREATE TYPE "RegistrationStatus" AS ENUM ('BLOCKED','PENDING','REGISTERED');
ALTER TABLE "Imei" ALTER COLUMN "registrationStatus" TYPE "RegistrationStatus" USING (CASE WHEN "registrationStatus"::text='NOT_REGISTERED' THEN NULL ELSE "registrationStatus"::text END)::"RegistrationStatus";
DROP TYPE "RegistrationStatus_old";
CREATE OR REPLACE FUNCTION require_registration_owner() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW."registrationStatus" IS NOT NULL THEN PERFORM 1 FROM "Equipment" WHERE id=NEW."equipmentId" AND "ownerId" IS NOT NULL FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'Registration requires an owner' USING ERRCODE='23514'; END IF; END IF; RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION protect_registration_owner() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW."ownerId" IS NULL AND EXISTS(SELECT 1 FROM "Imei" WHERE "equipmentId"=NEW.id AND "registrationStatus" IS NOT NULL) THEN RAISE EXCEPTION 'Registered equipment requires an owner' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
UPDATE "Imei" i SET "registrationStatus"=r.status::text::"RegistrationStatus" FROM "RegistrationRequest" r WHERE r."imeiId"=i.id;
UPDATE "Imei" SET "registeredAt"=NULL,"registeredById"=NULL WHERE "registrationStatus" IS DISTINCT FROM 'REGISTERED';
ALTER TABLE "Imei" ADD CONSTRAINT registration_dates CHECK (("registrationStatus"='REGISTERED' AND "registeredAt" IS NOT NULL) OR ("registrationStatus" IS DISTINCT FROM 'REGISTERED' AND "registeredAt" IS NULL));
CREATE FUNCTION validate_request_imei_state() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE target uuid; expected text; actual text; BEGIN
 IF TG_TABLE_NAME='Imei' THEN target:=NEW.id; ELSE target:=COALESCE(NEW."imeiId",OLD."imeiId"); END IF;
 SELECT status::text INTO expected FROM "RegistrationRequest" WHERE "imeiId"=target;
 IF FOUND THEN SELECT "registrationStatus"::text INTO actual FROM "Imei" WHERE id=target; IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Request and IMEI states must agree' USING ERRCODE='23514'; END IF; END IF; RETURN NULL; END $$;
CREATE CONSTRAINT TRIGGER request_state_consistency AFTER INSERT OR UPDATE ON "RegistrationRequest" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_request_imei_state();
CREATE CONSTRAINT TRIGGER imei_request_consistency AFTER UPDATE ON "Imei" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_request_imei_state();
-- Preserve consumed reservations as well as existing codes; never cycle.
DO $$ DECLARE maximum bigint; consumed bigint; called boolean; BEGIN
 SELECT COALESCE(max(substring(code FROM 6)::bigint),0) INTO maximum FROM "RegistrationRequest" WHERE code ~ '^RECO-[0-9]+$';
 SELECT last_value,is_called INTO consumed,called FROM registration_code_seq;
 IF greatest(maximum,consumed)>999999 THEN RAISE EXCEPTION 'REFINEMENT_REVIEW_REQUIRED: registration numbering exceeds six digits'; END IF;
 IF maximum>consumed OR (maximum=consumed AND maximum>0) THEN PERFORM setval('registration_code_seq',greatest(maximum,consumed),true); END IF;
END $$;
ALTER SEQUENCE registration_code_seq MAXVALUE 999999 NO CYCLE;
DROP TRIGGER sale_line_active ON "SaleEquipment";
DROP TRIGGER sale_status_lines ON "Sale";
DROP FUNCTION maintain_active_sale_line();
DROP FUNCTION refresh_sale_lines();
DROP INDEX sale_equipment_one_active;
ALTER TABLE "SaleEquipment" DROP COLUMN "isActive";
CREATE UNIQUE INDEX sale_equipment_unique_device ON "SaleEquipment"("equipmentId");
ALTER TABLE "Sale" DROP COLUMN status;
DROP TYPE "SaleStatus";
DELETE FROM "RolePermission" WHERE "permissionKey" IN ('sales.cancel','registration.cancel');
DELETE FROM "Permission" WHERE key IN ('sales.cancel','registration.cancel');
INSERT INTO "Permission"(key) VALUES ('sales.delete'),('registration.delete'),('equipment.delete');
INSERT INTO "RolePermission"("roleId","permissionKey") SELECT id,p.key FROM "Role" CROSS JOIN (VALUES ('sales.delete'),('registration.delete'),('equipment.delete')) p(key) WHERE code='SUPERADMIN';
COMMIT;
