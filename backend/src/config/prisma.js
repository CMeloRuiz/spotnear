/**
 * Cliente Prisma único para toda la app (evita agotar el pool con --watch).
 *
 * Incluye reintento de errores de conexión transitorios. Hace falta porque los
 * Postgres serverless (Neon, Supabase) suspenden la base cuando no se usa, y la
 * primera consulta después de un rato falla en vez de esperar el arranque. Sin
 * esto, el primero que entra a la web después de un rato de calma se come un
 * error, y en un producto de reservas eso es una venta perdida.
 */
import { PrismaClient } from '@prisma/client';
import env from './env.js';

/**
 * Códigos que indican que la consulta NUNCA llegó al servidor o que la
 * conexión se cortó antes de ejecutarla. Reintentarlos es seguro: no puede
 * haber quedado nada a medias.
 *
 *  P1001 — no se pudo alcanzar el servidor
 *  P1002 — se alcanzó pero venció el tiempo de espera
 *  P1017 — el servidor cerró la conexión
 *  P2024 — se agotó el tiempo esperando una conexión del pool
 */
const CODIGOS_TRANSITORIOS = new Set(['P1001', 'P1002', 'P1017', 'P2024']);

/**
 * Prisma expone el código en dos propiedades distintas según el tipo de error:
 *
 *  · PrismaClientKnownRequestError    → `code`      (falla una consulta)
 *  · PrismaClientInitializationError  → `errorCode` (no se pudo conectar)
 *
 * Y a veces en ninguna: cuando una consulta dispara la conexión perezosa contra
 * una base dormida, el error llega como PrismaClientInitializationError con
 * `errorCode: undefined`. Por eso el tipo del error manda sobre el código: un
 * error de inicialización es, por definición, un problema de conexión, y
 * reintentarlo siempre es lo correcto.
 */
function codigoDeError(error) {
  return error?.code ?? error?.errorCode ?? null;
}

export function esErrorTransitorio(error) {
  if (error?.name === 'PrismaClientInitializationError') return true;
  return CODIGOS_TRANSITORIOS.has(codigoDeError(error));
}

const MAX_INTENTOS = 5;
/**
 * Espera creciente. Los primeros saltos son cortos porque cubren un hipo del
 * pool; los últimos son largos porque despertar una base suspendida de Neon
 * tarda varios segundos, no milisegundos.
 */
const ESPERAS_MS = [300, 1000, 3000, 6000];

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function crearCliente() {
  const base = new PrismaClient({
    log: env.isDev ? ['warn', 'error'] : ['error'],
  });

  return base.$extends({
    query: {
      /**
       * Un estacionamiento eliminado definitivamente no existe para nadie.
       *
       * La fila puede seguir en la tabla como ancla de sus reservas (ver la
       * migración 20260927110000), pero no tiene que aparecer en ninguna
       * consulta: ni en el panel, ni en la búsqueda pública, ni en el acceso
       * del dueño. Filtrarlo acá y no en cada consulta es a propósito: son
       * veinte lugares que leen Parking y alcanza con que uno se olvide para
       * que el estacionamiento reaparezca.
       *
       * Las operaciones de escritura y los borrados no pasan por acá: el único
       * código que toca una fila eliminada es el que la eliminó.
       */
      parking: {
        async $allOperations({ args, query, operation }) {
          // `findUnique` entra: desde Prisma 4.5 el `where` admite un filtro
          // extra al lado del campo único, así que buscar por id o por slug
          // tampoco devuelve un estacionamiento eliminado.
          const LECTURAS = [
            'findMany', 'findFirst', 'findFirstOrThrow', 'findUnique', 'findUniqueOrThrow',
            'count', 'aggregate', 'groupBy',
          ];
          if (!LECTURAS.includes(operation)) return query(args);

          // Si quien consulta ya se refirió a la columna, manda lo que pidió:
          // es el panel de auditoría o la propia eliminación.
          const yaFiltra = args?.where && 'eliminadoEn' in args.where;
          if (yaFiltra) return query(args);

          return query({ ...args, where: { ...args?.where, eliminadoEn: null } });
        },
      },

      /**
       * Una reserva eliminada desde el panel tampoco existe para nadie.
       *
       * Mismo criterio y misma mecánica que `parking` acá arriba: si la seña ya
       * se cobró, la fila queda como registro de esa plata, pero se esconde de
       * todas las pantallas operativas. El reporte de ingresos es el único que
       * la quiere ver, y opta por incluirla nombrando `eliminadaEn` en su
       * propio `where`.
       */
      reservation: {
        async $allOperations({ args, query, operation }) {
          const LECTURAS = [
            'findMany', 'findFirst', 'findFirstOrThrow', 'findUnique', 'findUniqueOrThrow',
            'count', 'aggregate', 'groupBy',
          ];
          if (!LECTURAS.includes(operation)) return query(args);
          if (args?.where && 'eliminadaEn' in args.where) return query(args);

          return query({ ...args, where: { ...args?.where, eliminadaEn: null } });
        },
      },

      async $allOperations({ args, query, model, operation }) {
        let ultimoError;

        for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
          try {
            return await query(args);
          } catch (error) {
            if (!esErrorTransitorio(error) || intento === MAX_INTENTOS) throw error;

            ultimoError = error;
            const espera = ESPERAS_MS[intento - 1] ?? 2000;

            if (intento === 1) {
              console.warn(
                `[base] ${model ?? ''}.${operation} falló con ${codigoDeError(error)} (la base puede estar despertando). Reintentando...`,
              );
            }
            await esperar(espera);
          }
        }

        throw ultimoError;
      },
    },
  });
}

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.__spotnearPrisma ?? crearCliente();

if (env.isDev) globalForPrisma.__spotnearPrisma = prisma;

/**
 * Conecta y despierta la base al arrancar.
 *
 * El reintento del `$extends` de arriba cubre las consultas de la app, pero NO
 * este `$connect()`. Y es justo el momento en que más falla: los Postgres
 * serverless se suspenden solos, y si el servidor arranca (o nodemon lo
 * reinicia por un cambio de archivo) con la base dormida, el primer intento
 * rebota con P1001 y el proceso se caía sin llegar a escuchar.
 *
 * Los intentos son más espaciados que los de las consultas porque despertar una
 * base suspendida tarda unos segundos, no milisegundos.
 */
export async function conectarBase() {
  const ESPERAS = [1000, 3000, 5000];

  for (let intento = 0; intento <= ESPERAS.length; intento++) {
    try {
      await prisma.$connect();
      // Consulta trivial para despertar la base: así el primer usuario no paga
      // el cold start.
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch (error) {
      const esUltimo = intento === ESPERAS.length;
      if (!esErrorTransitorio(error) || esUltimo) throw error;

      console.info(
        `  La base está despertando (${codigoDeError(error)}). Reintento ${intento + 1} de ${ESPERAS.length}...`,
      );
      await esperar(ESPERAS[intento]);
    }
  }
}

export async function desconectarBase() {
  await prisma.$disconnect();
}

export default prisma;
