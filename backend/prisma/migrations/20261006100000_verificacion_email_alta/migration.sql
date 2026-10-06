-- Verificación de email en el alta por autogestión.
--
-- Estado nuevo: la solicitud nace PENDIENTE_VERIFICACION y pasa a
-- PENDIENTE_APROBACION recién cuando el dueño hace clic en el link del email.
ALTER TYPE "ParkingEstado" ADD VALUE IF NOT EXISTS 'PENDIENTE_VERIFICACION' BEFORE 'PENDIENTE_APROBACION';

-- Token de verificación (hasheado) y cuándo se confirmó.
ALTER TABLE "User" ADD COLUMN "emailVerificadoEn" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "verificacionTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN "verificacionExpiraEn" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_verificacionTokenHash_key" ON "User"("verificacionTokenHash");
