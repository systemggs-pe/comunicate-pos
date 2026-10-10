ALTER TABLE "User" ADD COLUMN "identityDocument" VARCHAR(8);
ALTER TABLE "User" ADD CONSTRAINT "user_identity_document_format" CHECK ("identityDocument" IS NULL OR "identityDocument" ~ '^[0-9]{8}$');
