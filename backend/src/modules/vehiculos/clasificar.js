/**
 * Detección del tipo de vehículo a partir de la marca y el modelo.
 *
 * Cruza lo que escribió el cliente contra el catálogo propio de SpotNear
 * (tabla VehicleModelCatalog). Si no hay coincidencia devuelve null y el
 * cliente elige el tipo a mano: nunca se asume un tipo por defecto, porque
 * equivocarse para abajo le cobra de menos al estacionamiento.
 *
 * Cómo compara, para que "vw  t cross", "VW T-Cross" y "Volkswagen T-Cross
 * Highline" den lo mismo:
 *   · todo en minúsculas, sin tildes ni signos ni espacios ("t-cross" → "tcross");
 *   · alias comunes de marca ("vw" → "volkswagen", "chevy" → "chevrolet");
 *   · el modelo escrito puede traer la versión detrás ("Hilux SRV 4x4"): gana
 *     el modelo del catálogo más largo que sea su comienzo, así "Corolla
 *     Cross" se distingue de "Corolla".
 */
import prisma from '../../config/prisma.js';

/** "Citroën C4-Cactus" → "citroenc4cactus" */
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Cómo escribe la gente algunas marcas, ya normalizado. */
const ALIAS_DE_MARCA = {
  vw: 'volkswagen',
  volks: 'volkswagen',
  volkswaguen: 'volkswagen',
  chevy: 'chevrolet',
  chevrolett: 'chevrolet',
  mercedes: 'mercedesbenz',
  mb: 'mercedesbenz',
  benz: 'mercedesbenz',
  mercedez: 'mercedesbenz',
  mercedezbenz: 'mercedesbenz',
  bmv: 'bmw',
  peugot: 'peugeot',
  pegeot: 'peugeot',
  reno: 'renault',
  toyotta: 'toyota',
};

export function normalizarMarca(marca) {
  const n = normalizar(marca);
  return ALIAS_DE_MARCA[n] ?? n;
}

/* ── Caché en memoria: el catálogo son ~100 filas y cambia poco ── */
let cache = null;

/** El panel lo llama al agregar, editar o borrar una fila. */
export function invalidarCatalogo() {
  cache = null;
}

async function catalogo() {
  cache ??= await prisma.vehicleModelCatalog.findMany({
    select: { id: true, marca: true, modelo: true, tipo: true, marcaNormalizada: true, modeloNormalizado: true },
  });
  return cache;
}

/**
 * Busca la entrada del catálogo que corresponde a una marca y un modelo.
 * Pura: recibe las filas, así se puede probar sin base de datos.
 *
 * @param {Array<{ marcaNormalizada: string, modeloNormalizado: string }>} filas
 * @returns {object|null} la fila que coincide, o null
 */
export function buscarEnCatalogo(filas, marca, modelo) {
  const m = normalizarMarca(marca);
  const mod = normalizar(modelo);
  if (!m || !mod) return null;

  let mejor = null;
  for (const fila of filas) {
    if (fila.marcaNormalizada !== m) continue;
    if (!mod.startsWith(fila.modeloNormalizado)) continue;
    if (!mejor || fila.modeloNormalizado.length > mejor.modeloNormalizado.length) mejor = fila;
  }
  return mejor;
}

/**
 * @returns {Promise<{ tipo: string, marca: string, modelo: string }|null>}
 */
export async function clasificarVehiculo(marca, modelo) {
  const fila = buscarEnCatalogo(await catalogo(), marca, modelo);
  return fila ? { tipo: fila.tipo, marca: fila.marca, modelo: fila.modelo } : null;
}

/** Lista para el autocompletado del formulario: marca, modelo y tipo. */
export async function listarCatalogo() {
  const filas = await catalogo();
  return filas
    .map(({ marca, modelo, tipo }) => ({ marca, modelo, tipo }))
    .sort((a, b) => a.marca.localeCompare(b.marca, 'es') || a.modelo.localeCompare(b.modelo, 'es'));
}

export default { normalizar, normalizarMarca, buscarEnCatalogo, clasificarVehiculo, listarCatalogo, invalidarCatalogo };
