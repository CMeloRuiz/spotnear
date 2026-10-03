-- Pago anticipado en la plataforma + liquidaciones periódicas al dueño.
--
-- Escrita a mano porque la base no estaba accesible al generarla. Es equivalente
-- a lo que produce `prisma migrate dev`, más el backfill del subtotal.

-- ── Estados de pago nuevos ──
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PENDIENTE';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'FALLIDO';

-- ── Ciclo y estado de liquidación ──
DO $$ BEGIN
  CREATE TYPE "CicloLiquidacion" AS ENUM ('SEMANAL', 'MENSUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EstadoLiquidacion" AS ENUM ('PENDIENTE', 'PAGADA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Parking: ciclo propio, opcional (null = el global del .env) ──
ALTER TABLE "Parking" ADD COLUMN IF NOT EXISTS "cicloLiquidacion" "CicloLiquidacion";

-- ── Reservation: subtotal, fecha de pago y liquidación asociada ──
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "pagadaEn" TIMESTAMP(3);
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "payoutId" TEXT;

-- Backfill: en las reservas viejas la comisión se descontaba del total, así que
-- lo que cobraba el estacionamiento era el neto. Ese es su subtotal histórico.
UPDATE "Reservation" SET "subtotal" = "montoNeto" WHERE "subtotal" = 0;

-- ── Liquidaciones ──
CREATE TABLE IF NOT EXISTS "Payout" (
  "id" TEXT NOT NULL,
  "parkingId" TEXT NOT NULL,
  "periodoDesde" TIMESTAMP(3) NOT NULL,
  "periodoHasta" TIMESTAMP(3) NOT NULL,
  "ciclo" "CicloLiquidacion" NOT NULL,
  "montoBruto" DECIMAL(12,2) NOT NULL,
  "montoComision" DECIMAL(12,2) NOT NULL,
  "montoNeto" DECIMAL(12,2) NOT NULL,
  "cantidadReservas" INTEGER NOT NULL DEFAULT 0,
  "moneda" TEXT NOT NULL DEFAULT 'ARS',
  "estado" "EstadoLiquidacion" NOT NULL DEFAULT 'PENDIENTE',
  "pagadaEn" TIMESTAMP(3),
  "notas" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- Una sola liquidación por estacionamiento y período: hace idempotente al
-- generador, que se puede correr las veces que haga falta sin duplicar nada.
CREATE UNIQUE INDEX IF NOT EXISTS "Payout_parkingId_periodoDesde_periodoHasta_key"
  ON "Payout" ("parkingId", "periodoDesde", "periodoHasta");
CREATE INDEX IF NOT EXISTS "Payout_estado_idx" ON "Payout" ("estado");
CREATE INDEX IF NOT EXISTS "Payout_parkingId_periodoDesde_idx" ON "Payout" ("parkingId", "periodoDesde");
CREATE INDEX IF NOT EXISTS "Reservation_payoutId_idx" ON "Reservation" ("payoutId");

DO $$ BEGIN
  ALTER TABLE "Payout" ADD CONSTRAINT "Payout_parkingId_fkey"
    FOREIGN KEY ("parkingId") REFERENCES "Parking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_payoutId_fkey"
    FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
