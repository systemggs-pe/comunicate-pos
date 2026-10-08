CREATE SEQUENCE client_code_seq;
CREATE SEQUENCE equipment_code_seq;
CREATE SEQUENCE sale_code_seq;
CREATE FUNCTION next_visible_code(seq regclass, prefix text) RETURNS text
LANGUAGE plpgsql VOLATILE AS $$
DECLARE n text;
BEGIN
  n := nextval(seq)::text;
  RETURN prefix || lpad(n, greatest(6, length(n)), '0');
END;
$$;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EquipmentOrigin" AS ENUM ('STORE', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('ACTIVE', 'RETURNED', 'BLOCKED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ImeiType" AS ENUM ('PHYSICAL', 'ESIM');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('NOT_REGISTERED', 'PENDING', 'PROCESSING', 'REGISTERED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "EquipmentEventType" AS ENUM ('EQUIPMENT_CREATED', 'OWNER_ASSIGNED', 'OWNER_CHANGED', 'IMEI_ADDED', 'IMEI_REGISTRATION_STARTED', 'IMEI_REGISTERED', 'IMEI_REGISTRATION_REJECTED', 'IMEI_REGISTRATION_CANCELLED', 'IMEI_REGISTRATION_UPDATED', 'SOLD', 'SALE_CANCELLED', 'EQUIPMENT_UPDATED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL DEFAULT next_visible_code('client_code_seq'::regclass, 'CL-'::text),
    "dni" VARCHAR(8) NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(30),
    "email" VARCHAR(254),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL DEFAULT next_visible_code('equipment_code_seq'::regclass, 'EQ-'::text),
    "ownerId" UUID,
    "origin" "EquipmentOrigin" NOT NULL,
    "brand" VARCHAR(100) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "serialNumber" VARCHAR(100),
    "status" "EquipmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Imei" (
    "id" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "slot" INTEGER NOT NULL,
    "value" VARCHAR(15) NOT NULL,
    "type" "ImeiType" NOT NULL DEFAULT 'PHYSICAL',
    "registrationStatus" "RegistrationStatus" NOT NULL DEFAULT 'NOT_REGISTERED',
    "registrationMethod" VARCHAR(100),
    "registrationStartedAt" TIMESTAMPTZ(3),
    "registeredAt" TIMESTAMPTZ(3),
    "registeredById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Imei_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL DEFAULT next_visible_code('sale_code_seq'::regclass, 'SALE-'::text),
    "buyerId" UUID NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'PENDING',
    "total" DECIMAL(12,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleEquipment" (
    "id" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentHistory" (
    "id" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "eventType" "EquipmentEventType" NOT NULL,
    "imeiId" UUID,
    "userId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" UUID NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Client_code_key" ON "Client"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Client_dni_key" ON "Client"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_code_key" ON "Equipment"("code");

-- CreateIndex
CREATE INDEX "Equipment_ownerId_idx" ON "Equipment"("ownerId");

-- CreateIndex
CREATE INDEX "Equipment_brand_model_idx" ON "Equipment"("brand", "model");

-- CreateIndex
CREATE UNIQUE INDEX "Imei_value_key" ON "Imei"("value");

-- CreateIndex
CREATE INDEX "Imei_registrationStatus_idx" ON "Imei"("registrationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Imei_equipmentId_slot_key" ON "Imei"("equipmentId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "Imei_id_equipmentId_key" ON "Imei"("id", "equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_code_key" ON "Sale"("code");

-- CreateIndex
CREATE INDEX "Sale_buyerId_createdAt_idx" ON "Sale"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "SaleEquipment_equipmentId_idx" ON "SaleEquipment"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleEquipment_saleId_equipmentId_key" ON "SaleEquipment"("saleId", "equipmentId");

-- CreateIndex
CREATE INDEX "EquipmentHistory_equipmentId_createdAt_idx" ON "EquipmentHistory"("equipmentId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Imei" ADD CONSTRAINT "Imei_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Imei" ADD CONSTRAINT "Imei_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleEquipment" ADD CONSTRAINT "SaleEquipment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleEquipment" ADD CONSTRAINT "SaleEquipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentHistory" ADD CONSTRAINT "EquipmentHistory_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentHistory" ADD CONSTRAINT "EquipmentHistory_imeiId_equipmentId_fkey" FOREIGN KEY ("imeiId", "equipmentId") REFERENCES "Imei"("id", "equipmentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentHistory" ADD CONSTRAINT "EquipmentHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Reglas de integridad fuera de las capacidades declarativas de Prisma 6.
ALTER TABLE "Client" ADD CONSTRAINT client_dni_digits CHECK (dni ~ '^[0-9]{8}$');
ALTER TABLE "Imei" ADD CONSTRAINT imei_value_digits CHECK (value ~ '^[0-9]{15}$');
ALTER TABLE "Imei" ADD CONSTRAINT imei_slot_range CHECK (slot IN (1, 2));
ALTER TABLE "Equipment" ADD CONSTRAINT external_requires_owner CHECK (origin <> 'EXTERNAL' OR "ownerId" IS NOT NULL);
ALTER TABLE "Sale" ADD CONSTRAINT sale_total_positive CHECK (total >= 0);
ALTER TABLE "SaleEquipment" ADD CONSTRAINT sale_unit_price_positive CHECK ("unitPrice" >= 0);
ALTER TABLE "Imei" ADD CONSTRAINT registration_dates CHECK (
  ("registrationStatus" = 'REGISTERED' AND "registeredAt" IS NOT NULL)
  OR ("registrationStatus" <> 'REGISTERED' AND "registeredAt" IS NULL)
);

-- Un proceso de registro sólo puede involucrar equipos con propietario.
CREATE FUNCTION require_registration_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."registrationStatus" <> 'NOT_REGISTERED' THEN
    PERFORM 1 FROM "Equipment" WHERE id = NEW."equipmentId" AND "ownerId" IS NOT NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Registration requires an owner' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER imei_registration_owner BEFORE INSERT OR UPDATE ON "Imei" FOR EACH ROW EXECUTE FUNCTION require_registration_owner();
CREATE FUNCTION protect_registration_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."ownerId" IS NULL AND EXISTS (SELECT 1 FROM "Imei" WHERE "equipmentId" = NEW.id AND "registrationStatus" <> 'NOT_REGISTERED') THEN
    RAISE EXCEPTION 'Registered equipment requires an owner' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER equipment_registration_owner BEFORE UPDATE OF "ownerId" ON "Equipment" FOR EACH ROW EXECUTE FUNCTION protect_registration_owner();

-- Flag técnico mantenido por PostgreSQL, nunca por el consumidor de la API.
-- El índice parcial garantiza exclusividad incluso bajo concurrencia.
CREATE UNIQUE INDEX sale_equipment_one_active ON "SaleEquipment" ("equipmentId") WHERE "isActive";
CREATE FUNCTION maintain_active_sale_line() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sale_status "SaleStatus";
BEGIN
  SELECT status INTO sale_status FROM "Sale" WHERE id = NEW."saleId" FOR SHARE;
  NEW."isActive" := sale_status IN ('PENDING', 'COMPLETED');
  IF NEW."isActive" THEN
    PERFORM 1 FROM "Equipment" WHERE id = NEW."equipmentId" AND origin = 'STORE' AND status = 'ACTIVE' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Only active store equipment can be sold' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER sale_line_active BEFORE INSERT OR UPDATE ON "SaleEquipment" FOR EACH ROW EXECUTE FUNCTION maintain_active_sale_line();
CREATE FUNCTION refresh_sale_lines() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "SaleEquipment" SET "isActive" = NEW.status IN ('PENDING', 'COMPLETED') WHERE "saleId" = NEW.id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER sale_status_lines AFTER UPDATE OF status ON "Sale" FOR EACH ROW EXECUTE FUNCTION refresh_sale_lines();

-- Total y líneas deben coincidir al final de la transacción (no durante nested create).
CREATE FUNCTION validate_sale_total() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid; recorded numeric; computed numeric; n bigint;
BEGIN
  IF TG_TABLE_NAME = 'Sale' THEN target := NEW.id;
  ELSE target := COALESCE(NEW."saleId", OLD."saleId"); END IF;
  SELECT total INTO recorded FROM "Sale" WHERE id = target;
  IF FOUND THEN
    SELECT COALESCE(sum("unitPrice"),0), count(*) INTO computed,n FROM "SaleEquipment" WHERE "saleId" = target;
    IF n = 0 OR recorded <> computed THEN RAISE EXCEPTION 'Sale total must match nonempty lines' USING ERRCODE = '23514'; END IF;
  END IF;
  IF TG_TABLE_NAME = 'SaleEquipment' THEN
  IF TG_OP = 'UPDATE' AND OLD."saleId" <> NEW."saleId" THEN
    SELECT total INTO recorded FROM "Sale" WHERE id = OLD."saleId";
    IF FOUND THEN
      SELECT COALESCE(sum("unitPrice"),0), count(*) INTO computed,n FROM "SaleEquipment" WHERE "saleId" = OLD."saleId";
      IF n = 0 OR recorded <> computed THEN RAISE EXCEPTION 'Previous sale total mismatch' USING ERRCODE = '23514'; END IF;
    END IF;
  END IF;
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER sale_total_consistency AFTER INSERT OR UPDATE ON "Sale" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_sale_total();
CREATE CONSTRAINT TRIGGER sale_lines_consistency AFTER INSERT OR UPDATE OR DELETE ON "SaleEquipment" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_sale_total();
