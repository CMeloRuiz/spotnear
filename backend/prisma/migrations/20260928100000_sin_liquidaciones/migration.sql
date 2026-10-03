-- Se elimina el sistema de liquidaciones.
--
-- Con el modelo de seña no reembolsable, SpotNear ya no le debe transferir
-- plata a ningún estacionamiento: el cliente le paga la tarifa completa en el
-- lugar, directo al dueño, y lo único que cobra la plataforma es la seña del
-- 10% que el cliente paga online al reservar.
--
-- Como no hay nada que liquidar, los ciclos de liquidación (semanal/mensual),
-- los pagos pendientes a dueños y la tabla que los guardaba quedan sin sentido.
-- Lo que SpotNear retiene se sigue viendo en el reporte de Comisiones, que bajo
-- este modelo ES el reporte de ingresos de la plataforma.
--
-- La tabla estaba vacía al momento de esta migración: nunca se generó una
-- liquidación real, así que no se pierde ningún dato.

-- 1. La referencia desde las reservas.
ALTER TABLE "Reservation" DROP COLUMN IF EXISTS "payoutId";

-- 2. El ciclo configurado por estacionamiento.
ALTER TABLE "Parking" DROP COLUMN IF EXISTS "cicloLiquidacion";

-- 3. La tabla y su enum.
DROP TABLE IF EXISTS "Payout";
DROP TYPE IF EXISTS "CicloLiquidacion";
DROP TYPE IF EXISTS "EstadoPayout";
