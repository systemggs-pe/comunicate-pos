ALTER TABLE "Sale" ADD COLUMN "historicalBuyerName" VARCHAR(201);
ALTER TABLE "SaleEquipment" ADD COLUMN "historicalEquipment" JSONB;
ALTER TABLE "SaleEquipment" ADD CONSTRAINT sale_historical_equipment_object
  CHECK ("historicalEquipment" IS NULL OR jsonb_typeof("historicalEquipment") = 'object');
