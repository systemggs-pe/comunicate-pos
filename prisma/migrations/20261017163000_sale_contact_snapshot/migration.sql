-- Contacto operativo de la venta; no altera la ficha ni rellena históricos.
ALTER TABLE "Sale" ADD COLUMN "buyerPhone" VARCHAR(30), ADD COLUMN "buyerEmail" VARCHAR(254);
