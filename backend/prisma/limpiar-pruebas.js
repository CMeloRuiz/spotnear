/**
 * Limpia los datos que dejan los tests de integración.
 *
 * Cada corrida crea estacionamientos con el slug prefijado `test-` y los borra
 * al terminar. Si la corrida se interrumpe (Ctrl+C, un fallo en un hook), esos
 * datos quedan y ensucian la búsqueda pública. Este script los saca.
 *
 *   npm run db:limpiar-pruebas
 *
 * Nunca toca datos reales: se guía solo por el prefijo `test-` del slug y por
 * el dominio `@test-…` de los emails de prueba.
 */
import 'dotenv/config';
// Cliente compartido de la app: trae el reintento de errores de conexión,
// que hace falta porque los Postgres serverless suspenden la base.
import prisma from '../src/config/prisma.js';


async function main() {
  // Dos criterios, porque hay tests que renombran el estacionamiento y el slug
  // se deriva del nombre: al renombrarlo deja de empezar con `test-`. El email
  // de los usuarios de prueba, en cambio, no cambia nunca.
  const parkings = await prisma.parking.findMany({
    where: {
      OR: [
        { slug: { startsWith: 'test-' } },
        { usuarios: { some: { email: { contains: '@test-' } } } },
        // Los fixtures siempre usan esta dirección. Hace falta como tercer
        // criterio para el caso borde: un test renombra el estacionamiento
        // (el slug se regenera y pierde el prefijo) y la limpieza alcanza a
        // borrar sus usuarios antes de fallar, dejándolo huérfano.
        { direccion: 'Calle Falsa 123' },
      ],
    },
    select: { id: true, nombre: true },
  });

  console.info(`\n🧹 Estacionamientos de prueba encontrados: ${parkings.length}`);

  if (parkings.length > 0) {
    const ids = parkings.map((p) => p.id);
    for (const p of parkings) console.info(`   · ${p.nombre}`);

    const reservas = await prisma.reservation.findMany({
      where: { parkingId: { in: ids } },
      select: { customerId: true, vehicleId: true },
    });

    await prisma.notificationLog.deleteMany({
      where: { reservation: { parkingId: { in: ids } } },
    });

    const { count: reservasBorradas } = await prisma.reservation.deleteMany({
      where: { parkingId: { in: ids } },
    });

    // Clientes y vehículos se comparten entre reservas (se deduplican por
    // teléfono y por patente): solo se borran los que quedaron huérfanos.
    await prisma.customer.deleteMany({
      where: { id: { in: reservas.map((r) => r.customerId) }, reservas: { none: {} } },
    });
    await prisma.vehicle.deleteMany({
      where: { id: { in: reservas.map((r) => r.vehicleId) }, reservas: { none: {} } },
    });

    await prisma.auditLog.deleteMany({ where: { parkingId: { in: ids } } });
    await prisma.refreshToken.deleteMany({ where: { user: { parkingId: { in: ids } } } });
    await prisma.user.deleteMany({ where: { parkingId: { in: ids } } });

    const { count: parkingsBorrados } = await prisma.parking.deleteMany({
      where: { id: { in: ids } },
    });

    console.info(`   · ${reservasBorradas} reservas borradas`);
    console.info(`   · ${parkingsBorrados} estacionamientos borrados`);
  }

  // Usuarios de prueba que no quedaron atados a ningún estacionamiento
  const { count: usuarios } = await prisma.user.deleteMany({
    where: { email: { contains: '@test-' } },
  });
  if (usuarios > 0) console.info(`   · ${usuarios} usuarios de prueba borrados`);

  const [parkingsRestantes, reservasRestantes] = await Promise.all([
    prisma.parking.count(),
    prisma.reservation.count(),
  ]);

  console.info(
    `\n✔ Listo. Quedan ${parkingsRestantes} estacionamientos y ${reservasRestantes} reservas.\n`,
  );
}

main()
  .catch((error) => {
    console.error('\n✖ Falló la limpieza:\n', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
