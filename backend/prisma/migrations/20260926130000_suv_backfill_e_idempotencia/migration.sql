-- Segunda parte: usa el valor SUV del enum, que Postgres no deja usar en la
-- misma transacción en que se agrega.

-- ─────────────── Los estacionamientos que aceptaban "Camioneta / SUV" ───────────────
-- La etiqueta vieja cubría las dos cosas, así que el que aceptaba camionetas
-- también aceptaba SUVs. Se les suma SUV para no dejarlos de golpe rechazando
-- un vehículo que antes recibían.
UPDATE "Parking"
SET "tiposVehiculo" = array_append("tiposVehiculo", 'SUV'::"VehicleType")
WHERE 'CAMIONETA' = ANY ("tiposVehiculo")
  AND NOT ('SUV' = ANY ("tiposVehiculo"));

-- ─────────────── Las tarifas de "Camioneta / SUV" ───────────────
-- No se puede saber con cuál de los dos se quedaba el dueño, así que se duplica
-- la tarifa para SUV con el mismo precio. Queda igual que antes hasta que él
-- decida diferenciarlas, que es justo lo que este cambio le permite hacer.
INSERT INTO "Rate" (
  "id", "parkingId", "tipo", "precio", "descripcion", "vehicleType",
  "vigenciaDesde", "vigenciaHasta", "activo", "createdAt", "updatedAt"
)
SELECT
  -- cuid() no existe en Postgres: se arma un id único y reconocible.
  'suvmig' || substr(md5(random()::text || r."id"), 1, 19),
  r."parkingId", r."tipo", r."precio",
  COALESCE(r."descripcion", 'Tarifa SUV') , 'SUV'::"VehicleType",
  r."vigenciaDesde", r."vigenciaHasta", r."activo", NOW(), NOW()
FROM "Rate" r
WHERE r."vehicleType" = 'CAMIONETA'
  AND NOT EXISTS (
    SELECT 1 FROM "Rate" x
    WHERE x."parkingId" = r."parkingId" AND x."tipo" = r."tipo" AND x."vehicleType" = 'SUV'
  );

-- Los vehículos ya cargados en reservas pasadas se dejan como CAMIONETA: no hay
-- forma de saber cuáles eran SUV, y cambiarlos falsearía el histórico.

-- ─────────────── Idempotencia del alta de reservas ───────────────
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Reservation_idempotencyKey_key"
  ON "Reservation" ("idempotencyKey");
