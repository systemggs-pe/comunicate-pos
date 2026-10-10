BEGIN;
-- Preserve previous completion when the user explicitly leaves a historical
-- blocked request awaiting UNBLOCK in the current operational model.
ALTER TABLE "RegistrationRequest" ADD COLUMN "legacyCompletedAt" timestamptz(3);
UPDATE "RegistrationRequest" SET "legacyCompletedAt"="completedAt" WHERE "legacyStatus" IS NOT NULL;
UPDATE "RegistrationRequest" SET "completedAt"=NULL,"completedById"=NULL WHERE status<>'REGISTERED';
SET CONSTRAINTS ALL IMMEDIATE;
ALTER TABLE "RegistrationRequest" ADD CONSTRAINT request_completion_integrity CHECK (
 (status='REGISTERED' AND "completedAt" IS NOT NULL AND "completedById" IS NOT NULL)
 OR (status<>'REGISTERED' AND "completedAt" IS NULL AND "completedById" IS NULL)
);
COMMIT;
