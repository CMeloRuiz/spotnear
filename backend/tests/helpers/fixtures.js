/**
 * Datos de prueba para los tests de integración.
 *
 * Cada corrida crea sus propios estacionamientos con un sufijo aleatorio y los
 * borra al terminar, así los tests no dependen del seed ni se pisan entre sí
 * si dos personas los corren contra la misma base de desarrollo.
 */
import crypto from 'node:crypto';
import prisma from '../../src/config/prisma.js';
import { hashearPassword } from '../../src/modules/auth/auth.service.js';

/** Sufijo único de esta corrida, para no chocar con datos existentes. */
export const SUFIJO = `test-${crypto.randomBytes(4).toString('hex')}`;

/**
 * Ids de los estacionamientos creados en esta corrida.
 *
 * La limpieza se guía por estos ids y no solo por el slug: hay tests que editan
 * el nombre del estacionamiento, y como el slug se deriva del nombre, deja de
 * tener el prefijo `test-` y se volvería invisible para el borrado.
 */
const parkingsCreados = new Set();

/** Fecha futura y estable, lejos de cualquier dato del seed. */
export function fechaFutura(diasAdelante, hora = 10) {
  const d = new Date();
  d.setDate(d.getDate() + 200 + diasAdelante);
  d.setHours(hora, 0, 0, 0);
  return d;
}

/**
 * Crea un estacionamiento de prueba con tarifa por hora y un usuario OWNER.
 *
 * @param {object} opciones
 * @param {number} [opciones.capacidad=2]
 * @param {number} [opciones.precioHora=1000]
 * @param {number} [opciones.comision=10]
 * @param {string} [opciones.nombre]
 */
export async function crearParkingDePrueba({
  capacidad = 2,
  precioHora = 1000,
  comision = 10,
  nombre = 'Parking de prueba',
} = {}) {
  const id = crypto.randomBytes(4).toString('hex');

  const parking = await prisma.parking.create({
    data: {
      slug: `${SUFIJO}-${id}`,
      nombre: `${nombre} ${id}`,
      direccion: 'Calle Falsa 123',
      barrio: 'Villa Crespo',
      lat: -34.5965,
      lng: -58.4489,
      capacidadTotal: capacidad,
      cubierto: true,
      tiposVehiculo: ['AUTO', 'CAMIONETA', 'MOTO'],
      comisionPorcentaje: comision,
      horarios: { abierto24h: true },
      activo: true,
      publicado: true,
      tarifas: {
        create: [
          { tipo: 'HORA', precio: precioHora, descripcion: 'Por hora' },
          { tipo: 'DIA', precio: precioHora * 10, descripcion: 'Por día' },
        ],
      },
    },
  });

  parkingsCreados.add(parking.id);

  const owner = await prisma.user.create({
    data: {
      email: `owner-${id}@${SUFIJO}.test`,
      nombre: `Dueño ${id}`,
      role: 'OWNER',
      parkingId: parking.id,
      passwordHash: await hashearPassword('ClaveDePrueba123'),
    },
  });

  const staff = await prisma.user.create({
    data: {
      email: `staff-${id}@${SUFIJO}.test`,
      nombre: `Playero ${id}`,
      role: 'STAFF',
      parkingId: parking.id,
      passwordHash: await hashearPassword('ClaveDePrueba123'),
    },
  });

  return { parking, owner, staff, password: 'ClaveDePrueba123' };
}

/** Crea un SUPERADMIN de prueba. */
export async function crearSuperadminDePrueba() {
  const id = crypto.randomBytes(4).toString('hex');
  const usuario = await prisma.user.create({
    data: {
      email: `super-${id}@${SUFIJO}.test`,
      nombre: 'Superadmin de prueba',
      role: 'SUPERADMIN',
      passwordHash: await hashearPassword('ClaveDePrueba123'),
    },
  });
  return { usuario, password: 'ClaveDePrueba123' };
}

/** Cuerpo válido de reserva, listo para postear. */
export function cuerpoReserva(parkingId, inicio, fin, extra = {}) {
  // `cliente` y `vehiculo` se combinan campo por campo con los de por defecto:
  // pasar solo la patente no tiene que borrar la marca, el modelo y el color,
  // que son obligatorios.
  const { cliente, vehiculo, ...resto } = extra;
  return {
    parkingId,
    inicio: inicio.toISOString(),
    fin: fin.toISOString(),
    cliente: {
      nombre: 'Juan',
      apellido: 'Pérez',
      telefono: '11 1234 5678',
      ...cliente,
    },
    vehiculo: {
      patente: 'AB123CD',
      tipo: 'AUTO',
      marca: 'Toyota',
      modelo: 'Corolla',
      color: 'Gris',
      ...vehiculo,
    },
    ...resto,
  };
}

/** Inicia sesión por la API y devuelve el access token. */
export async function loguear(agente, email, password = 'ClaveDePrueba123') {
  const res = await agente.post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`No se pudo loguear a ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.accessToken;
}

/**
 * Borra todo lo que creó esta corrida de tests.
 * Se apoya en el sufijo único, así que nunca toca datos reales ni del seed.
 */
export async function limpiar() {
  const porSlug = await prisma.parking.findMany({
    where: { slug: { startsWith: 'test-' } },
    select: { id: true },
  });

  // Los ids registrados cubren los estacionamientos renombrados durante el test;
  // el filtro por slug atrapa restos de corridas anteriores interrumpidas.
  const ids = [...new Set([...parkingsCreados, ...porSlug.map((p) => p.id)])];

  if (ids.length > 0) {
    // Las reservas guardan clientes y vehículos que también hay que limpiar.
    const reservas = await prisma.reservation.findMany({
      where: { parkingId: { in: ids } },
      select: { customerId: true, vehicleId: true },
    });

    await prisma.notificationLog.deleteMany({ where: { reservation: { parkingId: { in: ids } } } });
    await prisma.reservation.deleteMany({ where: { parkingId: { in: ids } } });

    // Los clientes se deduplican por teléfono y los vehículos por patente, así
    // que el mismo registro puede estar compartido con reservas que NO son de
    // esta corrida. Solo se borran los que quedaron sin ninguna reserva.
    await prisma.customer.deleteMany({
      where: { id: { in: reservas.map((r) => r.customerId) }, reservas: { none: {} } },
    });
    await prisma.vehicle.deleteMany({
      where: { id: { in: reservas.map((r) => r.vehicleId) }, reservas: { none: {} } },
    });
  }

  await prisma.auditLog.deleteMany({ where: { user: { email: { endsWith: `@${SUFIJO}.test` } } } });
  await prisma.refreshToken.deleteMany({ where: { user: { email: { endsWith: `@${SUFIJO}.test` } } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: `@${SUFIJO}.test` } } });
  // Parking cascadea tarifas, fotos, bloqueos y campos extra.
  if (ids.length > 0) await prisma.parking.deleteMany({ where: { id: { in: ids } } });
  parkingsCreados.clear();
}
