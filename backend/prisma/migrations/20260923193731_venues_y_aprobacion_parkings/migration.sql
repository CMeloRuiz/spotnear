-- CreateEnum
CREATE TYPE "ParkingEstado" AS ENUM ('PENDIENTE_APROBACION', 'ACTIVO', 'RECHAZADO');

-- DropIndex
DROP INDEX "Parking_publicado_activo_idx";

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "venueId" TEXT;

-- AlterTable
ALTER TABLE "Parking" ADD COLUMN     "estado" "ParkingEstado" NOT NULL DEFAULT 'ACTIVO',
ADD COLUMN     "motivoRechazo" TEXT,
ADD COLUMN     "revisadoEn" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "barrio" TEXT,
    "ciudad" TEXT NOT NULL DEFAULT 'Ciudad Autónoma de Buenos Aires',
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Venue_slug_key" ON "Venue"("slug");

-- CreateIndex
CREATE INDEX "Venue_activo_orden_idx" ON "Venue"("activo", "orden");

-- CreateIndex
CREATE INDEX "Event_venueId_idx" ON "Event"("venueId");

-- CreateIndex
CREATE INDEX "Parking_publicado_activo_estado_idx" ON "Parking"("publicado", "activo", "estado");

-- CreateIndex
CREATE INDEX "Parking_estado_idx" ON "Parking"("estado");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
