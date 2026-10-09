-- CreateEnum
CREATE SEQUENCE registration_code_seq;
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OperationalBlockStatus" AS ENUM ('BLOCKED', 'NOT_BLOCKED');

-- CreateEnum
CREATE TYPE "Operator" AS ENUM ('CLARO', 'MOVISTAR', 'ENTEL', 'BITEL');

-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN     "color" VARCHAR(100),
ADD COLUMN     "commercialName" VARCHAR(100),
ADD COLUMN     "ram" VARCHAR(100),
ADD COLUMN     "storage" VARCHAR(100);

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "idempotencyKey" UUID,
ADD COLUMN     "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "requestHash" VARCHAR(64);

-- CreateTable
CREATE TABLE "RegistrationOperation" (
    "id" UUID NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationRequest" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL DEFAULT next_visible_code('registration_code_seq'::regclass, 'RECO-'::text),
    "operationId" UUID NOT NULL,
    "imeiId" UUID NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "blockStatus" "OperationalBlockStatus" NOT NULL,
    "operator" "Operator" NOT NULL,
    "phone" VARCHAR(9) NOT NULL,
    "referencePhone" VARCHAR(9),
    "address" VARCHAR(300) NOT NULL,
    "department" VARCHAR(100) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "hasBox" BOOLEAN NOT NULL,
    "conditions" VARCHAR(1000) NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "completedAt" TIMESTAMPTZ(3),
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RegistrationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationRequestHistory" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationRequestHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleAccessory" (
    "id" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleAccessory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationOperation_idempotencyKey_key" ON "RegistrationOperation"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationRequest_code_key" ON "RegistrationRequest"("code");

-- CreateIndex
CREATE INDEX "RegistrationRequest_imeiId_createdAt_idx" ON "RegistrationRequest"("imeiId", "createdAt");

-- CreateIndex
CREATE INDEX "RegistrationRequest_status_createdAt_idx" ON "RegistrationRequest"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationRequest_operationId_imeiId_key" ON "RegistrationRequest"("operationId", "imeiId");

-- CreateIndex
CREATE INDEX "RegistrationRequestHistory_requestId_createdAt_idx" ON "RegistrationRequestHistory"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "SaleAccessory_saleId_idx" ON "SaleAccessory"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_idempotencyKey_key" ON "Sale"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "RegistrationOperation" ADD CONSTRAINT "RegistrationOperation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationRequest" ADD CONSTRAINT "RegistrationRequest_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "RegistrationOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationRequest" ADD CONSTRAINT "RegistrationRequest_imeiId_fkey" FOREIGN KEY ("imeiId") REFERENCES "Imei"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationRequest" ADD CONSTRAINT "RegistrationRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationRequest" ADD CONSTRAINT "RegistrationRequest_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationRequestHistory" ADD CONSTRAINT "RegistrationRequestHistory_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RegistrationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationRequestHistory" ADD CONSTRAINT "RegistrationRequestHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleAccessory" ADD CONSTRAINT "SaleAccessory_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Historical dates are preserved, not backdated to migration time.
UPDATE "Sale" SET "occurredAt" = "createdAt";
ALTER TABLE "Sale" ADD CONSTRAINT sale_idempotency_pair CHECK (("idempotencyKey" IS NULL) = ("requestHash" IS NULL));
ALTER TABLE "SaleAccessory" ADD CONSTRAINT accessory_positive_quantity CHECK (quantity BETWEEN 1 AND 10000),
 ADD CONSTRAINT accessory_nonnegative_price CHECK ("unitPrice" >= 0),
 ADD CONSTRAINT accessory_nonempty_name CHECK (length(trim(name)) > 0);
ALTER TABLE "RegistrationRequest" ADD CONSTRAINT request_phone CHECK (phone ~ '^9[0-9]{8}$'),
 ADD CONSTRAINT request_reference_phone CHECK ("referencePhone" IS NULL OR "referencePhone" ~ '^9[0-9]{8}$'),
 ADD CONSTRAINT request_nonnegative_price CHECK (price >= 0),
 ADD CONSTRAINT request_contact_required CHECK (length(trim(address)) > 0 AND length(trim(department)) > 0 AND length(trim(email)) > 0),
 ADD CONSTRAINT request_completed_date CHECK ((status = 'COMPLETED') = ("completedAt" IS NOT NULL));
CREATE UNIQUE INDEX request_one_live_per_imei ON "RegistrationRequest"("imeiId") WHERE status <> 'CANCELLED';
CREATE UNIQUE INDEX request_distinct_phone_per_operation ON "RegistrationRequest"("operationId", phone);

CREATE FUNCTION validate_request_imei_state() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid; request_state "RequestStatus"; imei_state "RegistrationStatus";
BEGIN
 IF TG_TABLE_NAME = 'Imei' THEN target := NEW.id; ELSE target := COALESCE(NEW."imeiId", OLD."imeiId"); END IF;
 SELECT status INTO request_state FROM "RegistrationRequest" WHERE "imeiId" = target AND status <> 'CANCELLED';
 IF FOUND THEN
  SELECT "registrationStatus" INTO imei_state FROM "Imei" WHERE id = target;
  IF (request_state = 'PENDING' AND imei_state <> 'PENDING') OR (request_state = 'COMPLETED' AND imei_state <> 'REGISTERED') THEN
   RAISE EXCEPTION 'Request and IMEI states must agree' USING ERRCODE = '23514';
  END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER request_state_consistency AFTER INSERT OR UPDATE ON "RegistrationRequest" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_request_imei_state();
CREATE CONSTRAINT TRIGGER imei_request_consistency AFTER UPDATE ON "Imei" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_request_imei_state();

CREATE OR REPLACE FUNCTION validate_sale_total() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid; recorded numeric; reduction numeric; computed numeric; n bigint; oldtarget uuid;
BEGIN
 IF TG_TABLE_NAME = 'Sale' THEN target := NEW.id;
 ELSE target := COALESCE(NEW."saleId", OLD."saleId"); END IF;
 FOR oldtarget IN SELECT target UNION SELECT CASE WHEN TG_TABLE_NAME <> 'Sale' AND TG_OP = 'UPDATE' THEN (to_jsonb(OLD)->>'saleId')::uuid ELSE target END LOOP
  SELECT total, discount INTO recorded,reduction FROM "Sale" WHERE id = oldtarget;
  IF FOUND THEN
   SELECT COALESCE(sum("unitPrice"),0),count(*) INTO computed,n FROM "SaleEquipment" WHERE "saleId" = oldtarget;
   computed := computed + (SELECT COALESCE(sum(quantity * "unitPrice"),0) FROM "SaleAccessory" WHERE "saleId" = oldtarget);
   IF n = 0 OR reduction > computed OR recorded <> computed - reduction THEN
    RAISE EXCEPTION 'Sale total must match equipment and accessories minus discount' USING ERRCODE = '23514';
   END IF;
  END IF;
 END LOOP;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER accessory_total_consistency AFTER INSERT OR UPDATE OR DELETE ON "SaleAccessory" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_sale_total();

INSERT INTO "Permission" (key) VALUES ('registration.cancel'), ('sales.update');
INSERT INTO "RolePermission" ("roleId", "permissionKey") SELECT id,p.key FROM "Role" CROSS JOIN (VALUES ('registration.cancel'),('sales.update')) AS p(key) WHERE code IN ('SUPERADMIN','ADMIN');
