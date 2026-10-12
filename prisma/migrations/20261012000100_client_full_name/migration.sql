ALTER TABLE "Client" ADD COLUMN "fullName" VARCHAR(201);
-- Preserve original names. A CODART full_name is not split into guessed surnames.
ALTER TABLE "Client" ADD CONSTRAINT client_full_name_nonblank CHECK ("fullName" IS NULL OR length(trim("fullName")) > 0);
