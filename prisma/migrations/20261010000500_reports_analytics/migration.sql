-- Additive indexes: business date cohorts, actors and real completion timestamps.
CREATE INDEX "Sale_occurredAt_idx" ON "Sale"("occurredAt");
CREATE INDEX "Sale_createdById_occurredAt_idx" ON "Sale"("createdById", "occurredAt");
CREATE INDEX "RegistrationRequest_occurredAt_idx" ON "RegistrationRequest"("occurredAt");
CREATE INDEX "RegistrationRequest_operator_status_occurredAt_idx" ON "RegistrationRequest"("operator", "status", "occurredAt");
CREATE INDEX "RegistrationRequest_createdById_createdAt_idx" ON "RegistrationRequest"("createdById", "createdAt");
CREATE INDEX "RegistrationRequest_completedAt_idx" ON "RegistrationRequest"("completedAt");
CREATE INDEX "RegistrationRequest_completedById_completedAt_idx" ON "RegistrationRequest"("completedById", "completedAt");
CREATE INDEX "Client_createdAt_idx" ON "Client"("createdAt");
CREATE INDEX "Equipment_createdAt_idx" ON "Equipment"("createdAt");
INSERT INTO "Permission"(key) VALUES ('reports.read'), ('reports.export');
INSERT INTO "RolePermission"("roleId", "permissionKey") SELECT id,p.key FROM "Role", "Permission" p WHERE "Role".code='SUPERADMIN' AND p.key IN ('reports.read','reports.export');
