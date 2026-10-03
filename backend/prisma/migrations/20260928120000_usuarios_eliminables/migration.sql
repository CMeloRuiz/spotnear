-- Eliminación definitiva de usuarios desde el panel (SUPERADMIN).
--
-- "Dar de baja" (activo = false) ya existía y se revierte. Esto borra la fila.
--
-- El único vínculo que se pierde al borrar un usuario es
-- Reservation.createdByUserId, que es ON DELETE SET NULL: sin precaución, todas
-- las reservas que cargó ese playero quedarían sin saber quién las tomó. Por
-- eso se guarda una copia del nombre en la reserva antes de borrarlo, igual
-- que se hizo con el nombre del estacionamiento al eliminarlo.
--
-- Los registros de auditoría también son SET NULL y se conservan: la acción
-- queda con su descripción aunque el usuario ya no exista.

ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "createdByNombre" TEXT;
