CREATE SEQUENCE user_code_seq;
-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "code" TEXT NOT NULL DEFAULT next_visible_code('user_code_seq'::regclass, 'USR-'::text),
ADD COLUMN     "lastLoginAt" TIMESTAMPTZ(3),
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "roleId" UUID,
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'DISABLED';

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "ip" VARCHAR(100),
ADD COLUMN     "userAgent" VARCHAR(300),
ALTER COLUMN "entityId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "key" VARCHAR(80) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" UUID NOT NULL,
    "permissionKey" VARCHAR(80) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionKey")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMPTZ(3),
    "ip" VARCHAR(100),
    "userAgent" VARCHAR(300),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthRateLimit" (
    "key" VARCHAR(64) NOT NULL,
    "attempts" INTEGER NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AuthRateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthRateLimit_expiresAt_idx" ON "AuthRateLimit"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_code_key" ON "User"("code");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionKey_fkey" FOREIGN KEY ("permissionKey") REFERENCES "Permission"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Emails canónicos, sin perder referencias de usuarios históricos.
UPDATE "User" SET email = lower(btrim(email));
ALTER TABLE "User" ADD CONSTRAINT user_email_normalized CHECK (email = lower(btrim(email)));
ALTER TABLE "User" ADD CONSTRAINT active_user_credentials CHECK (status <> 'ACTIVE' OR ("passwordHash" IS NOT NULL AND "roleId" IS NOT NULL));
INSERT INTO "Permission" (key) VALUES ('clients.read'),('clients.create'),('clients.update'),('equipment.read'),('equipment.create'),('equipment.update'),('registration.read'),('registration.create'),('registration.update'),('sales.read'),('sales.create'),('sales.cancel'),('users.read'),('users.create'),('users.update'),('users.disable'),('roles.read'),('roles.update'),('audit.read'),('settings.read'),('settings.update');
INSERT INTO "Role" (id,code) VALUES (gen_random_uuid(),'SUPERADMIN'),(gen_random_uuid(),'ADMIN'),(gen_random_uuid(),'SELLER');
INSERT INTO "RolePermission" ("roleId","permissionKey") SELECT r.id,p.key FROM "Role" r CROSS JOIN "Permission" p WHERE r.code='SUPERADMIN' OR (r.code='ADMIN' AND p.key NOT IN ('roles.update','settings.update')) OR (r.code='SELLER' AND p.key IN ('clients.read','clients.create','clients.update','equipment.read','equipment.create','registration.read','registration.create','registration.update','sales.read','sales.create'));
