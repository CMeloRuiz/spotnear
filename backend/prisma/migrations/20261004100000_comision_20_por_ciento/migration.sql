-- La seña de SpotNear pasa del 10% al 20%.
--
-- 1. Los estacionamientos nuevos nacen con 20%.
ALTER TABLE "Parking" ALTER COLUMN "comisionPorcentaje" SET DEFAULT 20.00;

-- 2. Los que tenían el 10% de antes pasan a 20%. Solo esos: si alguno tuviera
--    un porcentaje propio negociado, no se toca.
--    Las reservas ya hechas NO cambian: su comisión quedó congelada al reservar.
UPDATE "Parking" SET "comisionPorcentaje" = 20.00 WHERE "comisionPorcentaje" = 10.00;
