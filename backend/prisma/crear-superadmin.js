/**
 * Crea el primer administrador de la plataforma (SUPERADMIN), sin tocar nada más.
 *
 * Es lo que se corre en PRODUCCIÓN después del primer despliegue: el seed de
 * ejemplo borra todas las tablas y carga datos y usuarios de demo con claves
 * conocidas, así que en una base real no se usa. Sin al menos un SUPERADMIN no
 * hay quien entre al panel a aprobar estacionamientos.
 *
 *   SEED_SUPERADMIN_EMAIL=vos@tudominio.com \
 *   SEED_SUPERADMIN_PASSWORD='una-clave-larga' \
 *   npm run db:crear-superadmin
 *
 * Toma el email y la clave de SEED_SUPERADMIN_EMAIL y SEED_SUPERADMIN_PASSWORD
 * (las mismas variables que usa el seed). No tiene clave por defecto: en
 * producción una clave conocida es una puerta abierta.
 *
 * Si el email ya existe, no lo pisa ni le cambia la clave: avisa y termina.
 * Correrlo dos veces no hace daño.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from '../src/config/prisma.js';

/** Las mismas rondas que usa la app (src/modules/auth/auth.service.js). */
const RONDAS_BCRYPT = 10;
const LARGO_MINIMO = 12;

async function main() {
  const email = String(process.env.SEED_SUPERADMIN_EMAIL ?? '').trim().toLowerCase();
  const clave = String(process.env.SEED_SUPERADMIN_PASSWORD ?? '');

  if (!email || !email.includes('@')) {
    throw new Error('Falta SEED_SUPERADMIN_EMAIL (el email con el que vas a entrar al panel).');
  }
  if (clave.length < LARGO_MINIMO) {
    throw new Error(
      `SEED_SUPERADMIN_PASSWORD tiene que tener al menos ${LARGO_MINIMO} caracteres. ` +
        'Es la cuenta que puede todo: usá una clave larga y única.',
    );
  }

  const existente = await prisma.user.findUnique({ where: { email } });
  if (existente) {
    console.info(`\n• Ya existe un usuario con ${email} (${existente.role}). No se tocó nada.\n`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      nombre: 'Equipo SpotNear',
      role: 'SUPERADMIN',
      passwordHash: await bcrypt.hash(clave, RONDAS_BCRYPT),
    },
  });

  console.info(`\n✔ SUPERADMIN creado: ${email}. Ya podés entrar al panel en /panel/ingresar.\n`);
}

main()
  .catch((error) => {
    console.error(`\n✖ ${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
