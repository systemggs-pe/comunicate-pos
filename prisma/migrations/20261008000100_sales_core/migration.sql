ALTER TYPE "PaymentMethod" ADD VALUE 'YAPE';
ALTER TYPE "PaymentMethod" ADD VALUE 'PLIN';
ALTER TABLE "Sale" ADD COLUMN "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "notes" VARCHAR(1000);
ALTER TABLE "Sale" ADD CONSTRAINT sale_discount_positive CHECK (discount >= 0);

-- Mantener los triggers diferidos históricos; ampliar su función para descuento.
CREATE OR REPLACE FUNCTION validate_sale_total() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid; recorded numeric; reduction numeric; computed numeric; n bigint;
BEGIN
  IF TG_TABLE_NAME = 'Sale' THEN target := NEW.id;
  ELSE target := COALESCE(NEW."saleId", OLD."saleId"); END IF;
  SELECT total, discount INTO recorded,reduction FROM "Sale" WHERE id = target;
  IF FOUND THEN
    SELECT COALESCE(sum("unitPrice"),0), count(*) INTO computed,n FROM "SaleEquipment" WHERE "saleId" = target;
    IF n = 0 OR reduction > computed OR recorded <> computed - reduction THEN
      RAISE EXCEPTION 'Sale total must match nonempty lines minus discount' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_TABLE_NAME = 'SaleEquipment' AND TG_OP = 'UPDATE' THEN
    IF OLD."saleId" <> NEW."saleId" THEN
      SELECT total,discount INTO recorded,reduction FROM "Sale" WHERE id = OLD."saleId";
      IF FOUND THEN
        SELECT COALESCE(sum("unitPrice"),0), count(*) INTO computed,n FROM "SaleEquipment" WHERE "saleId" = OLD."saleId";
        IF n = 0 OR reduction > computed OR recorded <> computed - reduction THEN
          RAISE EXCEPTION 'Previous sale total mismatch' USING ERRCODE = '23514';
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
