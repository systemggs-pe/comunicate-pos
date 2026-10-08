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
