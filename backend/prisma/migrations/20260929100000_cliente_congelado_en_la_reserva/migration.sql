-- BUG DE INTEGRIDAD: una reserva nueva renombraba a todas las anteriores.
--
-- Causa: al reservar, el cliente se busca por teléfono y, si ya existía, se le
-- PISABA el nombre con el de la reserva nueva (obtenerOCrearCliente). Como la
-- reserva mostraba el nombre a través de la relación con Customer, todas las
-- reservas viejas de ese teléfono quedaban re-etiquetadas con el nombre del
-- último que reservó.
--
-- No era un UPDATE sin WHERE: el WHERE apuntaba bien a una sola fila de
-- Customer. El problema es de diseño: varias reservas comparten un Customer y
-- ninguna guardaba a nombre de quién se hizo.
--
-- Arreglo: la reserva congela los datos del cliente al momento de crearse. Un
-- comprobante emitido no puede cambiar después.
--
-- El backfill usa lo que haya: para las reservas afectadas, el nombre real se
-- recupera del texto que quedó guardado en NotificationLog cuando se creó cada
-- una. Para el resto, el nombre actual del Customer es correcto.

ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "clienteNombre"   TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "clienteApellido" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "clienteEmail"    TEXT;

-- Punto de partida: los datos actuales del cliente vinculado.
UPDATE "Reservation" r
SET "clienteNombre"   = c."nombre",
    "clienteApellido" = c."apellido",
    "clienteEmail"    = c."email"
FROM "Customer" c
WHERE c."id" = r."customerId"
  AND r."clienteNombre" IS NULL;

-- Recuperación de los nombres pisados.
--
-- El aviso al grupo del estacionamiento lleva la línea "👤 Nombre Apellido" con
-- el nombre tal como se cargó. Se toma el PRIMER registro de cada reserva, que
-- es el del momento de la creación.
WITH nombre_original AS (
  SELECT DISTINCT ON (n."reservationId")
         n."reservationId",
         trim(substring(n."payload"->>'texto' FROM '👤 ([^\n]+)')) AS nombre_completo
  FROM "NotificationLog" n
  WHERE n."reservationId" IS NOT NULL
    AND n."canal" = 'WHATSAPP'
    AND n."payload"->>'texto' LIKE '%👤 %'
  ORDER BY n."reservationId", n."createdAt" ASC
)
UPDATE "Reservation" r
SET "clienteNombre"   = split_part(o.nombre_completo, ' ', 1),
    "clienteApellido" = nullif(trim(substring(o.nombre_completo FROM position(' ' IN o.nombre_completo) + 1)), '')
FROM nombre_original o
WHERE o."reservationId" = r."id"
  AND o.nombre_completo IS NOT NULL
  AND o.nombre_completo <> ''
  AND position(' ' IN o.nombre_completo) > 0
  -- Solo donde el nombre guardado difiere del actual: son las pisadas.
  AND o.nombre_completo <> concat_ws(' ', r."clienteNombre", r."clienteApellido");
