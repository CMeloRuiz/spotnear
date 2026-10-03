-- Se elimina el estado de pago PENDIENTE_EN_LUGAR.
--
-- El modelo de cobro es por adelantado en la plataforma: el cliente paga antes
-- de que se genere el comprobante y SpotNear transfiere al estacionamiento
-- todas las semanas. "Pendiente de pago en el lugar" era del modelo anterior y
-- arrastraba la leyenda "(pago en el lugar)" hasta el comprobante final.
--
-- Las reservas que estaban en ese estado pasan a PENDIENTE: nunca se registró
-- un cobro para ellas, así que siguen pendientes de cobro. No se inventa un
-- PAGADO donde no hubo plata.

-- 1. El default tiene que soltar el valor viejo antes de recrear el tipo.
ALTER TABLE "Reservation" ALTER COLUMN "paymentStatus" DROP DEFAULT;

-- 2. Las filas existentes migran al estado equivalente.
UPDATE "Reservation" SET "paymentStatus" = 'PENDIENTE' WHERE "paymentStatus" = 'PENDIENTE_EN_LUGAR';

-- 3. Se recrea el enum sin el valor. PostgreSQL no permite quitar valores de un
--    tipo existente, así que se crea uno nuevo y se intercambia.
CREATE TYPE "PaymentStatus_new" AS ENUM ('PENDIENTE', 'PAGADO', 'FALLIDO', 'REEMBOLSADO');

ALTER TABLE "Reservation"
  ALTER COLUMN "paymentStatus" TYPE "PaymentStatus_new"
  USING ("paymentStatus"::text::"PaymentStatus_new");

DROP TYPE "PaymentStatus";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";

-- 4. Nuevo default: toda reserva nace pendiente de cobro.
ALTER TABLE "Reservation" ALTER COLUMN "paymentStatus" SET DEFAULT 'PENDIENTE';
