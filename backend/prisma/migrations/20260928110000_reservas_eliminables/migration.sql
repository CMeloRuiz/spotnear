-- Eliminación de reservas desde el panel (SUPERADMIN).
--
-- Mismo criterio que con los estacionamientos: donde hubo plata, no se borra.
--
--   · Seña sin cobrar (PENDIENTE / FALLIDO) → la fila se borra de verdad. No
--     hay nada que registrar: no entró un peso.
--   · Seña cobrada (PAGADO / REEMBOLSADO)   → la fila queda marcada con
--     eliminadaEn. Desaparece de las pantallas operativas y de los conteos,
--     pero se sigue contando en el reporte de ingresos de la plataforma:
--     la seña se cobró y es no reembolsable, así que borrarla sería falsear
--     la facturación.

ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "eliminadaEn" TIMESTAMP(3);

-- Casi todas las filas la tienen en NULL: un índice parcial es el que sirve.
CREATE INDEX IF NOT EXISTS "Reservation_eliminadaEn_idx" ON "Reservation" ("eliminadaEn")
  WHERE "eliminadaEn" IS NOT NULL;
