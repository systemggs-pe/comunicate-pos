ALTER TABLE "RegistrationRequest"
  ADD COLUMN "applicantId" UUID,
  ADD CONSTRAINT "RegistrationRequest_applicantId_fkey"
    FOREIGN KEY ("applicantId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "RegistrationRequest_applicantId_idx" ON "RegistrationRequest"("applicantId");
