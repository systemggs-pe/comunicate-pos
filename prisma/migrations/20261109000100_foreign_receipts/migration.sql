-- CreateTable
CREATE TABLE "ForeignReceipt" (
    "id" UUID NOT NULL,
    "folio" INTEGER NOT NULL,
    "format" INTEGER NOT NULL,
    "source" VARCHAR(10) NOT NULL,
    "clientId" UUID,
    "document" VARCHAR(20) NOT NULL,
    "issuedAt" TIMESTAMPTZ(3) NOT NULL,
    "purchaseAt" TIMESTAMPTZ(3),
    "totalPen" DECIMAL(14,2) NOT NULL,
    "totalClp" DECIMAL(16,2) NOT NULL,
    "totalUsd" DECIMAL(14,2) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "requestKey" UUID,
    "requestHash" VARCHAR(64),
    "legacyId" VARCHAR(200),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ForeignReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForeignReceiptLine" (
    "receiptId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "equipmentId" UUID,
    "saleEquipmentId" UUID,

    CONSTRAINT "ForeignReceiptLine_pkey" PRIMARY KEY ("receiptId","position")
);

-- CreateTable
CREATE TABLE "ForeignReceiptImei" (
    "imei" VARCHAR(15) NOT NULL,
    "receiptId" UUID NOT NULL,

    CONSTRAINT "ForeignReceiptImei_pkey" PRIMARY KEY ("imei")
);

-- CreateTable
CREATE TABLE "ForeignReceiptIssuer" (
    "format" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ForeignReceiptIssuer_pkey" PRIMARY KEY ("format")
);

-- CreateTable
CREATE TABLE "ForeignReceiptCounter" (
    "id" INTEGER NOT NULL,
    "last" INTEGER NOT NULL,

    CONSTRAINT "ForeignReceiptCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ForeignReceipt_folio_key" ON "ForeignReceipt"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "ForeignReceipt_requestKey_key" ON "ForeignReceipt"("requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "ForeignReceipt_legacyId_key" ON "ForeignReceipt"("legacyId");

-- CreateIndex
CREATE INDEX "ForeignReceipt_document_folio_idx" ON "ForeignReceipt"("document", "folio");

-- CreateIndex
CREATE INDEX "ForeignReceiptLine_equipmentId_idx" ON "ForeignReceiptLine"("equipmentId");

-- CreateIndex
CREATE INDEX "ForeignReceiptLine_saleEquipmentId_idx" ON "ForeignReceiptLine"("saleEquipmentId");

-- CreateIndex
CREATE INDEX "ForeignReceiptImei_receiptId_idx" ON "ForeignReceiptImei"("receiptId");

-- AddForeignKey
ALTER TABLE "ForeignReceipt" ADD CONSTRAINT "ForeignReceipt_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForeignReceiptLine" ADD CONSTRAINT "ForeignReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "ForeignReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForeignReceiptLine" ADD CONSTRAINT "ForeignReceiptLine_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForeignReceiptLine" ADD CONSTRAINT "ForeignReceiptLine_saleEquipmentId_fkey" FOREIGN KEY ("saleEquipmentId") REFERENCES "SaleEquipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForeignReceiptImei" ADD CONSTRAINT "ForeignReceiptImei_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "ForeignReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "ForeignReceipt" ADD CHECK ("format" BETWEEN 1 AND 7), ADD CHECK ("folio" > 0), ADD CHECK ("source" IN ('SALE', 'MANUAL', 'IMPORTED'));
ALTER TABLE "ForeignReceiptIssuer" ADD CHECK ("format" BETWEEN 1 AND 7);
ALTER TABLE "ForeignReceiptCounter" ADD CHECK ("id" = 1 AND "last" >= 999);
INSERT INTO "ForeignReceiptCounter" ("id", "last") VALUES (1, 999);

INSERT INTO "Permission" ("key") VALUES
  ('foreign-receipts.read'), ('foreign-receipts.create'), ('foreign-receipts.update'), ('foreign-receipts.issuers');
INSERT INTO "RolePermission" ("roleId", "permissionKey")
SELECT r.id, p.key FROM "Role" r CROSS JOIN "Permission" p
WHERE p.key LIKE 'foreign-receipts.%'
AND (r.code = 'SUPERADMIN' OR (r.code = 'ADMIN' AND p.key <> 'foreign-receipts.issuers')
  OR (r.code = 'SELLER' AND p.key IN ('foreign-receipts.read', 'foreign-receipts.create')));
