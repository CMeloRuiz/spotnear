-- Se quita toda la funcionalidad de eventos y se separa SUV de CAMIONETA.

-- ─────────────── SUV como tipo de vehículo propio ───────────────
-- En Postgres no se puede agregar un valor a un enum y usarlo en la misma
-- transacción, así que el backfill de datos va en la migración siguiente.
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'SUV' AFTER 'CAMIONETA';

-- ─────────────── Fuera las tarifas por evento ───────────────
-- Se borran antes de sacar el enum: son tarifas de algo que ya no existe.
DELETE FROM "Rate" WHERE "tipo" = 'EVENTO';

ALTER TABLE "Rate" DROP CONSTRAINT IF EXISTS "Rate_eventId_fkey";
DROP INDEX IF EXISTS "Rate_eventId_idx";
ALTER TABLE "Rate" DROP COLUMN IF EXISTS "eventId";

ALTER TABLE "Reservation" DROP CONSTRAINT IF EXISTS "Reservation_eventId_fkey";
DROP INDEX IF EXISTS "Reservation_eventId_idx";
ALTER TABLE "Reservation" DROP COLUMN IF EXISTS "eventId";

-- ─────────────── Fuera las tablas ───────────────
DROP TABLE IF EXISTS "Event";
DROP TABLE IF EXISTS "Venue";

-- ─────────────── RateType sin EVENTO ───────────────
-- Postgres no deja quitar un valor de un enum: hay que recrear el tipo.
ALTER TYPE "RateType" RENAME TO "RateType_viejo";
CREATE TYPE "RateType" AS ENUM ('HORA', 'DIA', 'MENSUAL');
ALTER TABLE "Rate" ALTER COLUMN "tipo" TYPE "RateType" USING ("tipo"::text::"RateType");
DROP TYPE "RateType_viejo";
