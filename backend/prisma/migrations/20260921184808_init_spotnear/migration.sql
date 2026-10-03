-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPERADMIN', 'OWNER', 'STAFF');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('AUTO', 'CAMIONETA', 'MOTO', 'UTILITARIO');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDIENTE', 'CONFIRMADA', 'EN_CURSO', 'FINALIZADA', 'CANCELADA', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDIENTE_EN_LUGAR', 'PAGADO', 'REEMBOLSADO');

-- CreateEnum
CREATE TYPE "RateType" AS ENUM ('HORA', 'DIA', 'MENSUAL', 'EVENTO');

-- CreateEnum
CREATE TYPE "ReservationSource" AS ENUM ('WEB', 'ADMIN', 'WHATSAPP', 'TELEFONO', 'API');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXTO', 'NUMERO', 'SELECT', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDIENTE', 'ENVIADO', 'FALLIDO', 'SIMULADO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "role" "Role" NOT NULL DEFAULT 'STAFF',
    "parkingId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parking" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "direccion" TEXT NOT NULL,
    "barrio" TEXT,
    "ciudad" TEXT NOT NULL DEFAULT 'Ciudad Autónoma de Buenos Aires',
    "provincia" TEXT NOT NULL DEFAULT 'CABA',
    "codigoPostal" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "googlePlaceId" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "whatsappGrupo" TEXT,
    "capacidadTotal" INTEGER NOT NULL,
    "cubierto" BOOLEAN NOT NULL DEFAULT true,
    "tiposVehiculo" "VehicleType"[] DEFAULT ARRAY['AUTO', 'CAMIONETA', 'MOTO']::"VehicleType"[],
    "servicios" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "horarios" JSONB NOT NULL DEFAULT '{}',
    "alturaMaximaCm" INTEGER,
    "comisionPorcentaje" DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "publicado" BOOLEAN NOT NULL DEFAULT true,
    "destacado" BOOLEAN NOT NULL DEFAULT false,
    "calificacion" DECIMAL(2,1),
    "cantidadResenas" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkingPhoto" (
    "id" TEXT NOT NULL,
    "parkingId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "portada" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParkingPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rate" (
    "id" TEXT NOT NULL,
    "parkingId" TEXT NOT NULL,
    "tipo" "RateType" NOT NULL,
    "precio" DECIMAL(12,2) NOT NULL,
    "descripcion" TEXT,
    "vehicleType" "VehicleType",
    "vigenciaDesde" TIMESTAMP(3),
    "vigenciaHasta" TIMESTAMP(3),
    "eventId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "lugar" TEXT NOT NULL,
    "direccion" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "patente" TEXT NOT NULL,
    "tipo" "VehicleType" NOT NULL DEFAULT 'AUTO',
    "marca" TEXT,
    "modelo" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "parkingId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "eventId" TEXT,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "estado" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMADA',
    "source" "ReservationSource" NOT NULL DEFAULT 'WEB',
    "cantidadVehiculos" INTEGER NOT NULL DEFAULT 1,
    "precioTotal" DECIMAL(12,2) NOT NULL,
    "comisionPorcentaje" DECIMAL(5,2) NOT NULL,
    "montoComision" DECIMAL(12,2) NOT NULL,
    "montoNeto" DECIMAL(12,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "desglosePrecio" JSONB,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDIENTE_EN_LUGAR',
    "paymentProvider" TEXT,
    "paymentRef" TEXT,
    "notas" TEXT,
    "camposExtra" JSONB NOT NULL DEFAULT '{}',
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "motivoCancelacion" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapacityBlock" (
    "id" TEXT NOT NULL,
    "parkingId" TEXT NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL,
    "hasta" TIMESTAMP(3) NOT NULL,
    "lugares" INTEGER NOT NULL,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapacityBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldConfig" (
    "id" TEXT NOT NULL,
    "parkingId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ayuda" TEXT,
    "tipo" "CustomFieldType" NOT NULL DEFAULT 'TEXTO',
    "requerido" BOOLEAN NOT NULL DEFAULT false,
    "opciones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomFieldConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT,
    "canal" "NotificationChannel" NOT NULL,
    "destino" TEXT NOT NULL,
    "estado" "NotificationStatus" NOT NULL DEFAULT 'PENDIENTE',
    "asunto" TEXT,
    "payload" JSONB,
    "error" TEXT,
    "proveedor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "parkingId" TEXT,
    "datos" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_parkingId_idx" ON "User"("parkingId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Parking_slug_key" ON "Parking"("slug");

-- CreateIndex
CREATE INDEX "Parking_publicado_activo_idx" ON "Parking"("publicado", "activo");

-- CreateIndex
CREATE INDEX "Parking_lat_lng_idx" ON "Parking"("lat", "lng");

-- CreateIndex
CREATE INDEX "ParkingPhoto_parkingId_orden_idx" ON "ParkingPhoto"("parkingId", "orden");

-- CreateIndex
CREATE INDEX "Rate_parkingId_tipo_activo_idx" ON "Rate"("parkingId", "tipo", "activo");

-- CreateIndex
CREATE INDEX "Rate_eventId_idx" ON "Rate"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE INDEX "Event_fechaInicio_activo_idx" ON "Event"("fechaInicio", "activo");

-- CreateIndex
CREATE INDEX "Customer_telefono_idx" ON "Customer"("telefono");

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Vehicle_patente_idx" ON "Vehicle"("patente");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_codigo_key" ON "Reservation"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_publicToken_key" ON "Reservation"("publicToken");

-- CreateIndex
CREATE INDEX "Reservation_parkingId_inicio_fin_idx" ON "Reservation"("parkingId", "inicio", "fin");

-- CreateIndex
CREATE INDEX "Reservation_parkingId_estado_idx" ON "Reservation"("parkingId", "estado");

-- CreateIndex
CREATE INDEX "Reservation_eventId_idx" ON "Reservation"("eventId");

-- CreateIndex
CREATE INDEX "Reservation_createdAt_idx" ON "Reservation"("createdAt");

-- CreateIndex
CREATE INDEX "CapacityBlock_parkingId_desde_hasta_idx" ON "CapacityBlock"("parkingId", "desde", "hasta");

-- CreateIndex
CREATE INDEX "CustomFieldConfig_parkingId_activo_orden_idx" ON "CustomFieldConfig"("parkingId", "activo", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldConfig_parkingId_key_key" ON "CustomFieldConfig"("parkingId", "key");

-- CreateIndex
CREATE INDEX "NotificationLog_reservationId_idx" ON "NotificationLog"("reservationId");

-- CreateIndex
CREATE INDEX "NotificationLog_canal_estado_idx" ON "NotificationLog"("canal", "estado");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entidad_entidadId_idx" ON "AuditLog"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "AuditLog_parkingId_createdAt_idx" ON "AuditLog"("parkingId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_parkingId_fkey" FOREIGN KEY ("parkingId") REFERENCES "Parking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingPhoto" ADD CONSTRAINT "ParkingPhoto_parkingId_fkey" FOREIGN KEY ("parkingId") REFERENCES "Parking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rate" ADD CONSTRAINT "Rate_parkingId_fkey" FOREIGN KEY ("parkingId") REFERENCES "Parking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rate" ADD CONSTRAINT "Rate_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_parkingId_fkey" FOREIGN KEY ("parkingId") REFERENCES "Parking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapacityBlock" ADD CONSTRAINT "CapacityBlock_parkingId_fkey" FOREIGN KEY ("parkingId") REFERENCES "Parking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldConfig" ADD CONSTRAINT "CustomFieldConfig_parkingId_fkey" FOREIGN KEY ("parkingId") REFERENCES "Parking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
