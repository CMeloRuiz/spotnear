-- Cobro real de la seña con Mercado Pago (Checkout Pro).
--
-- Dos datos nuevos por reserva, los dos nullable porque las reservas que se
-- cargan desde el panel no pasan por ninguna pasarela.

-- Link al checkout hospedado de Mercado Pago. Se guarda para que reintentar un
-- pago rechazado no obligue a crear otra preferencia ni a rearmar la reserva.
ALTER TABLE "Reservation" ADD COLUMN "paymentUrl" TEXT;

-- Estado crudo que devolvió la pasarela: approved, in_process, pending,
-- rejected, cancelled. El enum PaymentStatus es el del negocio (¿está la seña
-- o no?); esto es lo que hace falta para saber si al cliente le decimos
-- "estamos confirmando tu pago" o "el pago no se completó", que no es lo mismo.
ALTER TABLE "Reservation" ADD COLUMN "paymentDetalle" TEXT;

-- Se busca la reserva por el pago que avisa el webhook: external_reference es
-- el id, pero la reconciliación también entra por paymentRef (la preferencia).
CREATE INDEX "Reservation_paymentRef_idx" ON "Reservation"("paymentRef");
