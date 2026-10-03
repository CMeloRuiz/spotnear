-- Eliminación definitiva de un estacionamiento (SUPERADMIN).
--
-- "Dar de baja" (activo = false) despublica y se puede revertir. Esto es otra
-- cosa: el estacionamiento desaparece de la plataforma.
--
-- El problema: todas las relaciones apuntan a Parking con ON DELETE CASCADE,
-- reservas y liquidaciones incluidas. Borrar la fila se llevaría el historial
-- contable, que es justo lo que no se puede perder.
--
-- La solución, en dos casos:
--   · Sin reservas  → se borra la fila de verdad (la cascada limpia tarifas,
--                     fotos, campos extra y bloqueos de cupo, que sin el
--                     estacionamiento no significan nada).
--   · Con reservas  → la fila queda como ancla de esas reservas, marcada con
--                     eliminadoEn, y se esconde de TODAS las consultas. Antes
--                     de marcarla se copia el nombre y la dirección en cada
--                     reserva, para que el comprobante y el historial se sigan
--                     leyendo solos.

ALTER TABLE "Parking" ADD COLUMN IF NOT EXISTS "eliminadoEn" TIMESTAMP(3);

ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "parkingNombre" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "parkingDireccion" TEXT;

-- Todas las consultas filtran por esta columna, y la enorme mayoría de las
-- filas la tienen en NULL: un índice parcial es el que sirve acá.
CREATE INDEX IF NOT EXISTS "Parking_eliminadoEn_idx" ON "Parking" ("eliminadoEn")
  WHERE "eliminadoEn" IS NOT NULL;
