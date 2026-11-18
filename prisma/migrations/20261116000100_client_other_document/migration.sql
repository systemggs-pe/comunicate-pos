CREATE TYPE "ClientDocumentType" AS ENUM ('DNI', 'OTROS');

ALTER TABLE "Client"
  ADD COLUMN "documentType" "ClientDocumentType" NOT NULL DEFAULT 'DNI',
  ADD COLUMN "otherDocumentNumber" VARCHAR(100),
  ALTER COLUMN "dni" DROP NOT NULL;

ALTER TABLE "Client" ADD CONSTRAINT client_document_type_fields CHECK (
  ("documentType" = 'DNI' AND "dni" IS NOT NULL AND "otherDocumentNumber" IS NULL)
  OR ("documentType" = 'OTROS' AND "dni" IS NULL AND NULLIF(BTRIM("otherDocumentNumber"), '') IS NOT NULL)
);
