BEGIN;

-- Revoke sessions whose origin cannot be distinguished for linked accounts.
DELETE FROM "Session"
WHERE "userId" IN (
  SELECT id FROM "User"
  WHERE "googleSubject" IS NOT NULL OR "passwordHash" = '!google-only'
);

-- Remove unused accounts created solely for Google sign-in. Preserve operational history.
DELETE FROM "User"
WHERE "passwordHash" = '!google-only' AND "lastLoginAt" IS NULL;

UPDATE "User"
SET status = 'DISABLED', "passwordHash" = NULL, "updatedAt" = now()
WHERE "passwordHash" = '!google-only';

DROP TABLE "GoogleAuthAttempt";
ALTER TABLE "User" DROP COLUMN "googleSubject";

COMMIT;
