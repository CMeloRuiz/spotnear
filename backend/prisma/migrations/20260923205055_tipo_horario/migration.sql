-- CreateEnum
CREATE TYPE "TipoHorario" AS ENUM ('FIJO', 'ABIERTO_24HS', 'FIN_EVENTO');

-- AlterTable
ALTER TABLE "Parking" ADD COLUMN     "tipoHorario" "TipoHorario" NOT NULL DEFAULT 'FIJO';

-- Backfill: los estacionamientos que ya existían no tienen que romperse.
-- Los que traían `abierto24h: true` en el JSON de horarios pasan a ABIERTO_24HS;
-- el resto se queda en FIJO, que es el valor por defecto de la columna.
UPDATE "Parking"
SET "tipoHorario" = 'ABIERTO_24HS'
WHERE "horarios" -> 'abierto24h' = 'true'::jsonb;
