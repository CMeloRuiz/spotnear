/**
 * Seed de desarrollo de SpotNear.
 *
 * Carga un escenario realista alrededor del Movistar Arena (Humboldt 450,
 * Villa Crespo), que es el caso que originó el producto.
 *
 * ⚠ Borra y recrea los datos. Correr SOLO en desarrollo.
 *   npm run db:seed              (base vacía)
 *   npm run db:seed -- --forzar  (base con datos: la vacía primero)
 *
 * Sobre una base con usuarios se niega a correr sin --forzar: así no hay forma
 * de vaciar producción por un comando equivocado. Para producción, el primer
 * administrador se crea con `npm run db:crear-superadmin`, que no borra nada.
 */
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import 'dotenv/config';
// Cliente compartido de la app: trae el reintento de errores de conexión,
// que hace falta porque los Postgres serverless suspenden la base.
import prisma from '../src/config/prisma.js';
import { calcularPrecio } from '../src/services/pricing.js';


// ─────────────────────── Utilidades del seed ───────────────────────

const ALFABETO = '34679ACDEFGHJKMNPQRTUVWXY';

function codigo() {
  const bytes = crypto.randomBytes(6);
  let out = '';
  for (let i = 0; i < 6; i++) out += ALFABETO[bytes[i] % ALFABETO.length];
  return `SN-${out}`;
}

const token = () => crypto.randomBytes(32).toString('base64url');

/** Fecha relativa a hoy, en hora local argentina. */
function dia(offsetDias, hora = 0, minutos = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  d.setHours(hora, minutos, 0, 0);
  return d;
}

const elegir = (arr) => arr[Math.floor(Math.random() * arr.length)];
const entero = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const HORARIO_COMERCIAL = {
  abierto24h: false,
  lun: { abre: '07:00', cierra: '23:00' },
  mar: { abre: '07:00', cierra: '23:00' },
  mie: { abre: '07:00', cierra: '23:00' },
  jue: { abre: '07:00', cierra: '23:00' },
  vie: { abre: '07:00', cierra: '02:00' },
  sab: { abre: '08:00', cierra: '02:00' },
  dom: { abre: '09:00', cierra: '23:00' },
};

const HORARIO_24H = { abierto24h: true };

/**
 * Cierra cuando termina el evento: solo tiene hora de apertura.
 * Es el horario típico de los que están pegados a un estadio.
 */
const HORARIO_EVENTO = {
  abierto24h: false,
  lun: { abre: '08:00' },
  mar: { abre: '08:00' },
  mie: { abre: '08:00' },
  jue: { abre: '08:00' },
  vie: { abre: '08:00' },
  sab: { abre: '09:00' },
  dom: { abre: '09:00' },
};

// ─────────────────────── Datos base ───────────────────────

/**
 * Coordenadas aproximadas reales. El Movistar Arena está en
 * Humboldt 450, Villa Crespo (aprox. -34.5965, -58.4489).
 */
const PARKINGS = [
  {
    slug: 'humboldt-650',
    nombre: 'Estacionamiento Humboldt 650',
    descripcion:
      'A tres cuadras del Movistar Arena. Cubierto, con vigilancia las 24 horas y cámaras en todos los niveles. El clásico de los días de recital.',
    direccion: 'Humboldt 650',
    barrio: 'Villa Crespo',
    lat: -34.5972,
    lng: -58.4451,
    telefono: '+541148553120',
    whatsappGrupo: '+5491112345678',
    capacidadTotal: 60,
    cubierto: true,
    tiposVehiculo: ['AUTO', 'CAMIONETA', 'MOTO'],
    servicios: ['camaras', '24hs', 'vigilancia', 'techado'],
    tipoHorario: 'ABIERTO_24HS',
    horarios: HORARIO_24H,
    alturaMaximaCm: 210,
    calificacion: 4.7,
    cantidadResenas: 312,
    destacado: true,
    comisionPorcentaje: 20,
    tarifas: { hora: 2400, dia: 16000, mensual: 128000 },
    principal: true,
  },
  {
    slug: 'arena-park-darwin',
    nombre: 'Arena Park · Darwin 1180',
    descripcion:
      'El más cercano al Arena. Entrada y salida rápida por Darwin, ideal para irse apenas termina el show.',
    direccion: 'Darwin 1180',
    barrio: 'Villa Crespo',
    lat: -34.5939,
    lng: -58.4472,
    telefono: '+541148551877',
    whatsappGrupo: '+5491158220144',
    capacidadTotal: 45,
    cubierto: true,
    tiposVehiculo: ['AUTO', 'MOTO'],
    servicios: ['camaras', 'vigilancia', 'techado'],
    // A 300 m del Movistar Arena: abre temprano y cierra recién cuando
    // termina el show, que es el caso que motivó el modo FIN_EVENTO.
    tipoHorario: 'FIN_EVENTO',
    horarios: HORARIO_EVENTO,
    alturaMaximaCm: 195,
    calificacion: 4.9,
    cantidadResenas: 528,
    destacado: true,
    comisionPorcentaje: 20,
    tarifas: { hora: 2800, dia: 18500, mensual: 145000 },
  },
  {
    slug: 'padilla-cocheras',
    nombre: 'Padilla Cocheras',
    descripcion: 'Cocheras individuales en playa semicubierta. Acepta camionetas grandes y utilitarios.',
    direccion: 'Padilla 850',
    barrio: 'Villa Crespo',
    lat: -34.5988,
    lng: -58.4421,
    telefono: '+541148549002',
    whatsappGrupo: '+5491144329871',
    capacidadTotal: 38,
    cubierto: false,
    tiposVehiculo: ['AUTO', 'CAMIONETA', 'UTILITARIO', 'MOTO'],
    servicios: ['camaras', 'vigilancia'],
    tipoHorario: 'FIJO',
    horarios: HORARIO_COMERCIAL,
    calificacion: 4.3,
    cantidadResenas: 146,
    comisionPorcentaje: 20,
    tarifas: { hora: 1900, dia: 13000, mensual: 98000 },
  },
  {
    slug: 'corrientes-5400',
    nombre: 'Garage Corrientes 5400',
    descripcion: 'Sobre Avenida Corrientes, a metros del subte B. Cubierto en dos niveles.',
    direccion: 'Av. Corrientes 5400',
    barrio: 'Villa Crespo',
    lat: -34.6001,
    lng: -58.443,
    telefono: '+541148573311',
    whatsappGrupo: '+5491167884520',
    capacidadTotal: 80,
    cubierto: true,
    tiposVehiculo: ['AUTO', 'CAMIONETA', 'MOTO'],
    servicios: ['camaras', '24hs', 'techado', 'lavado'],
    tipoHorario: 'ABIERTO_24HS',
    horarios: HORARIO_24H,
    alturaMaximaCm: 220,
    calificacion: 4.5,
    cantidadResenas: 874,
    comisionPorcentaje: 20,
    tarifas: { hora: 2200, dia: 15000, mensual: 118000 },
  },
  {
    slug: 'chacarita-dorrego',
    nombre: 'Chacarita Parking · Dorrego 1500',
    descripcion: 'Playa amplia junto a la estación Dorrego. Buena opción si venís desde zona norte.',
    direccion: 'Av. Dorrego 1500',
    barrio: 'Chacarita',
    lat: -34.5864,
    lng: -58.4523,
    telefono: '+541148996677',
    whatsappGrupo: '+5491133445566',
    capacidadTotal: 120,
    cubierto: false,
    tiposVehiculo: ['AUTO', 'CAMIONETA', 'UTILITARIO', 'MOTO'],
    servicios: ['camaras', '24hs'],
    tipoHorario: 'ABIERTO_24HS',
    horarios: HORARIO_24H,
    calificacion: 4.1,
    cantidadResenas: 203,
    comisionPorcentaje: 20,
    tarifas: { hora: 1700, dia: 11500, mensual: 89000 },
  },
  {
    slug: 'palermo-gurruchaga',
    nombre: 'Palermo Soho · Gurruchaga 1100',
    descripcion: 'Cochera boutique en el corazón de Palermo Soho. Servicio de valet los fines de semana.',
    direccion: 'Gurruchaga 1100',
    barrio: 'Palermo',
    lat: -34.5909,
    lng: -58.4306,
    telefono: '+541147740099',
    whatsappGrupo: '+5491155667788',
    capacidadTotal: 32,
    cubierto: true,
    tiposVehiculo: ['AUTO', 'MOTO'],
    servicios: ['camaras', 'vigilancia', 'techado', 'valet'],
    tipoHorario: 'FIJO',
    horarios: HORARIO_COMERCIAL,
    alturaMaximaCm: 190,
    calificacion: 4.8,
    cantidadResenas: 421,
    comisionPorcentaje: 20,
    tarifas: { hora: 3200, dia: 21000, mensual: 165000 },
  },
  {
    slug: 'almagro-medrano',
    nombre: 'Almagro Estación · Medrano 250',
    descripcion: 'A una cuadra del subte A. Tarifas convenientes por estadía larga.',
    direccion: 'Av. Medrano 250',
    barrio: 'Almagro',
    lat: -34.6058,
    lng: -58.4201,
    telefono: '+541149815544',
    whatsappGrupo: '+5491199887766',
    capacidadTotal: 55,
    cubierto: true,
    tiposVehiculo: ['AUTO', 'CAMIONETA', 'MOTO'],
    servicios: ['camaras', 'techado'],
    tipoHorario: 'FIJO',
    horarios: HORARIO_COMERCIAL,
    alturaMaximaCm: 200,
    calificacion: 4.2,
    cantidadResenas: 189,
    comisionPorcentaje: 20,
    tarifas: { hora: 1800, dia: 12000, mensual: 92000 },
  },
  {
    slug: 'microcentro-sarmiento',
    nombre: 'Microcentro Premium · Sarmiento 1250',
    descripcion: 'Edificio de cocheras en pleno centro. Abierto las 24 horas, todos los días del año.',
    direccion: 'Sarmiento 1250',
    barrio: 'San Nicolás',
    lat: -34.6042,
    lng: -58.3835,
    telefono: '+541143822211',
    whatsappGrupo: '+5491122334455',
    capacidadTotal: 210,
    cubierto: true,
    tiposVehiculo: ['AUTO', 'CAMIONETA', 'MOTO', 'UTILITARIO'],
    servicios: ['camaras', '24hs', 'vigilancia', 'techado', 'cargador_electrico'],
    tipoHorario: 'ABIERTO_24HS',
    horarios: HORARIO_24H,
    alturaMaximaCm: 230,
    calificacion: 4.6,
    cantidadResenas: 1247,
    comisionPorcentaje: 20,
    tarifas: { hora: 2600, dia: 17500, mensual: 138000 },
  },
];

const NOMBRES = [
  ['Juan', 'Pérez'],
  ['María', 'González'],
  ['Santiago', 'Rodríguez'],
  ['Lucía', 'Fernández'],
  ['Matías', 'López'],
  ['Camila', 'Martínez'],
  ['Nicolás', 'Sánchez'],
  ['Valentina', 'Romero'],
  ['Federico', 'Díaz'],
  ['Sofía', 'Álvarez'],
  ['Agustín', 'Torres'],
  ['Martina', 'Ruiz'],
  ['Tomás', 'Ramírez'],
  ['Julieta', 'Flores'],
  ['Ignacio', 'Benítez'],
  ['Florencia', 'Acosta'],
  ['Joaquín', 'Medina'],
  ['Delfina', 'Herrera'],
  ['Bautista', 'Aguirre'],
  ['Catalina', 'Molina'],
];

const VEHICULOS = [
  { marca: 'Toyota', modelo: 'Corolla', tipo: 'AUTO', color: 'Gris' },
  { marca: 'Volkswagen', modelo: 'Gol Trend', tipo: 'AUTO', color: 'Blanco' },
  { marca: 'Ford', modelo: 'Ranger', tipo: 'CAMIONETA', color: 'Negro' },
  { marca: 'Chevrolet', modelo: 'Onix', tipo: 'AUTO', color: 'Rojo' },
  { marca: 'Peugeot', modelo: '208', tipo: 'AUTO', color: 'Azul' },
  { marca: 'Fiat', modelo: 'Cronos', tipo: 'AUTO', color: 'Plata' },
  { marca: 'Renault', modelo: 'Kangoo', tipo: 'UTILITARIO', color: 'Blanco' },
  { marca: 'Honda', modelo: 'Wave', tipo: 'MOTO', color: 'Negro' },
  { marca: 'Toyota', modelo: 'Hilux', tipo: 'CAMIONETA', color: 'Gris' },
  { marca: 'Citroën', modelo: 'C3', tipo: 'AUTO', color: 'Verde' },
];

/** Genera una patente argentina válida (mitad viejas, mitad Mercosur). */
function patenteAleatoria(i) {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const letra = () => L[entero(0, L.length - 1)];
  const num = () => String(entero(0, 9));
  return i % 2 === 0
    ? `${letra()}${letra()}${num()}${num()}${num()}${letra()}${letra()}` // Mercosur
    : `${letra()}${letra()}${letra()}${num()}${num()}${num()}`; // viejo
}

/** Teléfono móvil de CABA en E.164. */
function telefonoAleatorio() {
  return `+54911${entero(40000000, 69999999)}`;
}

// ─────────────────────── Seed ───────────────────────

async function limpiar() {
  console.info('  Limpiando datos anteriores...');
  // El orden importa por las claves foráneas.
  await prisma.notificationLog.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.capacityBlock.deleteMany();
  await prisma.rate.deleteMany();
  await prisma.customFieldConfig.deleteMany();
  await prisma.parkingPhoto.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.parking.deleteMany();
}

async function main() {
  console.info('\n🌱 Sembrando la base de SpotNear\n');

  // Resguardo: este seed BORRA todo antes de cargar el escenario de ejemplo.
  // Sobre una base con datos (producción, o tu base local con reservas que te
  // importan) se niega a correr, salvo que se lo pidas explícitamente. En una
  // base recién creada o recién reseteada (npm run setup / db:reset) no hay
  // usuarios y sigue de largo como siempre.
  const forzar = process.argv.includes('--forzar');
  const usuarios = await prisma.user.count();
  if (usuarios > 0 && !forzar) {
    console.error(
      [
        `✖ La base ya tiene datos (${usuarios} usuario${usuarios === 1 ? '' : 's'}). No se tocó nada.`,
        '',
        '  Este seed BORRA todas las tablas y carga datos de ejemplo.',
        '  · Si es tu base local y querés empezar de cero: npm run db:seed -- --forzar',
        '  · Si es PRODUCCIÓN: no lo corras. Para crear el primer administrador usá',
        '    npm run db:crear-superadmin (no borra nada).',
        '',
      ].join('\n'),
    );
    process.exitCode = 1;
    return;
  }

  await limpiar();

  // ── Estacionamientos ──
  console.info('  Creando estacionamientos...');
  const parkingsCreados = {};

  for (const [i, p] of PARKINGS.entries()) {
    const { tarifas, principal, ...datos } = p;

    const parking = await prisma.parking.create({
      data: {
        ...datos,
        email: `contacto@${p.slug}.com.ar`,
        fotos: {
          create: [
            { url: `/assets/parkings/${p.slug}-1.svg`, alt: `Ingreso de ${p.nombre}`, orden: 0, portada: true },
            { url: `/assets/parkings/${p.slug}-2.svg`, alt: `Interior de ${p.nombre}`, orden: 1 },
          ],
        },
      },
    });

    parkingsCreados[p.slug] = { ...parking, _tarifas: tarifas, _principal: principal };
    console.info(`    · ${p.nombre} (${p.capacidadTotal} lugares)`);
  }

  // ── Tarifas ──
  console.info('  Cargando tarifas...');
  for (const slug of Object.keys(parkingsCreados)) {
    const parking = parkingsCreados[slug];
    const t = parking._tarifas;

    const tarifas = [
      { tipo: 'HORA', precio: t.hora, descripcion: 'Tarifa por hora' },
      { tipo: 'DIA', precio: t.dia, descripcion: 'Estadía de 24 horas' },
      { tipo: 'MENSUAL', precio: t.mensual, descripcion: 'Abono mensual' },
    ];

    // Las motos pagan menos en los estacionamientos que las aceptan.
    if (parking.tiposVehiculo.includes('MOTO')) {
      tarifas.push({
        tipo: 'HORA',
        precio: Math.round(t.hora * 0.55),
        descripcion: 'Tarifa por hora · motos',
        vehicleType: 'MOTO',
      });
    }

    await prisma.rate.createMany({
      data: tarifas.map((x) => ({ ...x, parkingId: parking.id })),
    });

  }

  // ── Usuarios ──
  console.info('  Creando usuarios de prueba...');
  const principal = Object.values(parkingsCreados).find((p) => p._principal);

  const hash = (clave) => bcrypt.hash(clave, 10);

  const superadmin = await prisma.user.create({
    data: {
      email: process.env.SEED_SUPERADMIN_EMAIL ?? 'admin@spotnear.com.ar',
      nombre: 'Equipo ColdevIA',
      telefono: '+5491112345678',
      role: 'SUPERADMIN',
      passwordHash: await hash(process.env.SEED_SUPERADMIN_PASSWORD ?? 'SpotNear2026!'),
    },
  });

  const owner = await prisma.user.create({
    data: {
      email: process.env.SEED_OWNER_EMAIL ?? 'dueno@estacionamientohumboldt.com.ar',
      nombre: 'Roberto Gómez',
      telefono: '+5491144556677',
      role: 'OWNER',
      parkingId: principal.id,
      passwordHash: await hash(process.env.SEED_OWNER_PASSWORD ?? 'Humboldt2026!'),
    },
  });

  const staff = await prisma.user.create({
    data: {
      email: process.env.SEED_STAFF_EMAIL ?? 'playero@estacionamientohumboldt.com.ar',
      nombre: 'Carlos Ferreyra',
      telefono: '+5491133221100',
      role: 'STAFF',
      parkingId: principal.id,
      passwordHash: await hash(process.env.SEED_STAFF_PASSWORD ?? 'Playero2026!'),
    },
  });

  // Un OWNER de otro estacionamiento: sirve para comprobar el aislamiento.
  const otro = parkingsCreados['arena-park-darwin'];
  await prisma.user.create({
    data: {
      email: 'dueno@arenapark.com.ar',
      nombre: 'Silvia Bustos',
      telefono: '+5491166554433',
      role: 'OWNER',
      parkingId: otro.id,
      passwordHash: await hash('ArenaPark2026!'),
    },
  });

  // ── Campos extra configurables ──
  console.info('  Configurando campos opcionales del estacionamiento principal...');
  await prisma.customFieldConfig.createMany({
    data: [
      {
        parkingId: principal.id,
        key: 'numero_socio',
        label: 'Número de socio',
        ayuda: 'Si tenés abono mensual, dejanos tu número.',
        tipo: 'TEXTO',
        requerido: false,
        orden: 0,
      },
      {
        parkingId: principal.id,
        key: 'necesita_ayuda',
        label: '¿Necesitás asistencia para estacionar?',
        tipo: 'SELECT',
        opciones: ['No', 'Sí, por favor'],
        requerido: false,
        orden: 1,
      },
    ],
  });

  // ── Bloqueo de cupos de ejemplo ──
  await prisma.capacityBlock.create({
    data: {
      parkingId: principal.id,
      desde: dia(3, 8),
      hasta: dia(3, 20),
      lugares: 10,
      motivo: 'Mantenimiento del nivel 2',
    },
  });

  // ── Reservas ──
  console.info('  Generando reservas de ejemplo...');

  const slugsConReservas = [
    'humboldt-650',
    'humboldt-650',
    'humboldt-650',
    'arena-park-darwin',
    'padilla-cocheras',
    'corrientes-5400',
    'chacarita-dorrego',
    'palermo-gurruchaga',
  ];

  /**
   * Escenarios variados para que el panel se vea realista desde el minuto cero:
   * historial cerrado, actividad de hoy y reservas futuras.
   */
  const ESCENARIOS = [
    // Pasadas y cerradas
    { offset: -10, hora: 19, duracion: 5, estado: 'FINALIZADA' },
    { offset: -9, hora: 20, duracion: 4, estado: 'FINALIZADA' },
    { offset: -7, hora: 18, duracion: 6, estado: 'FINALIZADA' },
    { offset: -7, hora: 21, duracion: 4, estado: 'NO_SHOW' },
    { offset: -5, hora: 10, duracion: 8, estado: 'FINALIZADA' },
    { offset: -4, hora: 22, duracion: 3, estado: 'CANCELADA' },
    { offset: -3, hora: 14, duracion: 5, estado: 'FINALIZADA' },
    { offset: -2, hora: 19, duracion: 6, estado: 'FINALIZADA' },
    { offset: -1, hora: 20, duracion: 5, estado: 'FINALIZADA' },
    // Hoy
    { offset: 0, hora: 8, duracion: 10, estado: 'EN_CURSO' },
    { offset: 0, hora: 9, duracion: 9, estado: 'EN_CURSO' },
    { offset: 0, hora: 19, duracion: 5, estado: 'CONFIRMADA' },
    { offset: 0, hora: 20, duracion: 4, estado: 'CONFIRMADA' },
    { offset: 0, hora: 21, duracion: 4, estado: 'PENDIENTE' },
    // Futuras
    { offset: 1, hora: 18, duracion: 6, estado: 'CONFIRMADA' },
    { offset: 2, hora: 20, duracion: 5, estado: 'CONFIRMADA' },
    { offset: 5, hora: 19, duracion: 6, estado: 'CONFIRMADA' },
    { offset: 5, hora: 20, duracion: 5, estado: 'CONFIRMADA' },
    { offset: 5, hora: 20, duracion: 6, estado: 'CONFIRMADA' },
    { offset: 12, hora: 19, duracion: 6, estado: 'CONFIRMADA' },
    { offset: 12, hora: 18, duracion: 7, estado: 'CONFIRMADA' },
    { offset: 25, hora: 18, duracion: 5, estado: 'CONFIRMADA' },
  ];

  let i = 0;

  for (const esc of ESCENARIOS) {
    const [nombre, apellido] = NOMBRES[i % NOMBRES.length];
    const datosVehiculo = VEHICULOS[i % VEHICULOS.length];
    const slug = slugsConReservas[i % slugsConReservas.length];
    const parking = parkingsCreados[slug];

    // El estacionamiento tiene que aceptar ese tipo de vehículo
    const tipo = parking.tiposVehiculo.includes(datosVehiculo.tipo) ? datosVehiculo.tipo : 'AUTO';

    const cliente = await prisma.customer.create({
      data: {
        nombre,
        apellido,
        telefono: telefonoAleatorio(),
        email: i % 3 === 0 ? `${nombre.toLowerCase()}.${apellido.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@example.com` : null,
      },
    });

    const vehiculo = await prisma.vehicle.create({
      data: {
        patente: patenteAleatoria(i),
        tipo,
        marca: datosVehiculo.marca,
        modelo: datosVehiculo.modelo,
        color: datosVehiculo.color,
      },
    });

    const inicio = dia(esc.offset, esc.hora);
    const fin = new Date(inicio.getTime() + esc.duracion * 3_600_000);

    const t = parking._tarifas;

    // El precio lo calcula el mismo motor que usa la app, así el seed refleja
    // los escalones reales (media estadía, estadía completa) y no una copia que
    // se desactualiza en cuanto cambian las reglas.
    const { subtotal, precioTotal: totalConServicio, montoComision, montoNeto, desglose } =
      calcularPrecio({
        parking,
        tarifas: [
          { tipo: 'HORA', precio: t.hora },
          { tipo: 'DIA', precio: t.dia },
          { tipo: 'MENSUAL', precio: t.mensual },
        ],
        inicio,
        fin,
      });

    const pct = Number(parking.comisionPorcentaje);

    const esDelPrincipal = parking.id === principal.id;

    await prisma.reservation.create({
      data: {
        codigo: codigo(),
        publicToken: token(),
        parkingId: parking.id,
        customerId: cliente.id,
        vehicleId: vehiculo.id,
        inicio,
        fin,
        estado: esc.estado,
        source: elegir(['WEB', 'WEB', 'WEB', 'ADMIN', 'WHATSAPP']),
        cantidadVehiculos: 1,
        subtotal,
        precioTotal: totalConServicio,
        comisionPorcentaje: pct,
        montoComision,
        montoNeto,
        desglosePrecio: desglose,
        // Pago anticipado: todo lo confirmado ya se cobró.
        paymentStatus: ['CANCELADA', 'NO_SHOW'].includes(esc.estado) ? 'REEMBOLSADO' : 'PAGADO',
        pagadaEn: ['CANCELADA', 'NO_SHOW'].includes(esc.estado) ? null : new Date(),
        paymentProvider: 'simulado',
        notas: i % 5 === 0 ? 'Llega con el auto de un familiar, misma patente.' : null,
        camposExtra: esDelPrincipal && i % 4 === 0 ? { numero_socio: `S-${entero(100, 999)}` } : {},
        checkInAt: ['EN_CURSO', 'FINALIZADA'].includes(esc.estado) ? inicio : null,
        checkOutAt: esc.estado === 'FINALIZADA' ? fin : null,
        canceledAt: esc.estado === 'CANCELADA' ? dia(esc.offset - 1, 12) : null,
        motivoCancelacion: esc.estado === 'CANCELADA' ? 'El cliente canceló por WhatsApp.' : null,
        createdByUserId: elegir([null, null, null, staff.id, owner.id]),
      },
    });

    i += 1;
  }

  // ── Resumen ──
  const [totalParkings, totalReservas, totalTarifas] = await Promise.all([
    prisma.parking.count(),
    prisma.reservation.count(),
    prisma.rate.count(),
  ]);

  console.info(
    [
      '',
      '✔ Listo.',
      '',
      `  Estacionamientos: ${totalParkings}`,
      `  Tarifas:          ${totalTarifas}`,
      `  Reservas:         ${totalReservas}`,
      '',
      '  Usuarios de prueba (solo desarrollo):',
      `    SUPERADMIN  ${superadmin.email}  /  ${process.env.SEED_SUPERADMIN_PASSWORD ?? 'SpotNear2026!'}`,
      `    OWNER       ${owner.email}  /  ${process.env.SEED_OWNER_PASSWORD ?? 'Humboldt2026!'}`,
      `    STAFF       ${staff.email}  /  ${process.env.SEED_STAFF_PASSWORD ?? 'Playero2026!'}`,
      `    OWNER (2)   dueno@arenapark.com.ar  /  ArenaPark2026!`,
      '',
    ].join('\n'),
  );
}

main()
  .catch((error) => {
    console.error('\n✖ Falló el seed:\n', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
