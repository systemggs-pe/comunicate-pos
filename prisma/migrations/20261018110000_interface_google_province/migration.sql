ALTER TABLE "User" ADD COLUMN "googleSubject" VARCHAR(255);
CREATE UNIQUE INDEX "User_googleSubject_key" ON "User"("googleSubject");
ALTER TABLE "Client" ADD COLUMN "province" VARCHAR(100);
ALTER TABLE "RegistrationRequest" ADD COLUMN "province" VARCHAR(100);
CREATE TABLE "GoogleAuthAttempt" (
 "stateHash" VARCHAR(64) NOT NULL,
 "browserHash" VARCHAR(64) NOT NULL,
 "nonce" VARCHAR(43) NOT NULL,
 "verifier" VARCHAR(43) NOT NULL,
 "expiresAt" TIMESTAMPTZ(3) NOT NULL,
 CONSTRAINT "GoogleAuthAttempt_pkey" PRIMARY KEY ("stateHash")
);
CREATE INDEX "GoogleAuthAttempt_expiresAt_idx" ON "GoogleAuthAttempt"("expiresAt");
