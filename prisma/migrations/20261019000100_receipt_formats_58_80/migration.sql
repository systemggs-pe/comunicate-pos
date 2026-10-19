BEGIN;
ALTER TABLE "CompanySettings" DROP CONSTRAINT IF EXISTS "CompanySettings_defaultFormat_check";
UPDATE "CompanySettings" SET "defaultFormat" = 58, "updatedAt" = CURRENT_TIMESTAMP WHERE "defaultFormat" = 48;
ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_defaultFormat_check" CHECK ("defaultFormat" IN (58,80));
-- Keep the stored column name for compatibility; Prisma exposes it as margin58.
ALTER TABLE "CompanySettings" ALTER COLUMN "margin48" SET DEFAULT 3;
UPDATE "CompanySettings" SET "margin48" = 3, "updatedAt" = CURRENT_TIMESTAMP WHERE "margin48" = 1;
COMMIT;
