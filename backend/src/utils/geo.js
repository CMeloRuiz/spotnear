/**
 * Cálculos geográficos para la búsqueda por cercanía.
 * Se resuelve en SQL para filtrar y acá para mostrar distancias exactas.
 */

const RADIO_TIERRA_M = 6_371_000;
/** Velocidad peatonal usada por los mapas para estimar "X min caminando". */
const VELOCIDAD_CAMINANDO_M_POR_MIN = 80;

const rad = (grados) => (grados * Math.PI) / 180;

/**
 * Distancia en metros entre dos puntos (fórmula de Haversine).
 * @returns {number} metros
 */
export function distanciaEnMetros(latA, lngA, latB, lngB) {
  const dLat = rad(latB - latA);
  const dLng = rad(lngB - lngA);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(latA)) * Math.cos(rad(latB)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * RADIO_TIERRA_M * Math.asin(Math.sqrt(a)));
}

/**
 * Minutos caminando estimados. Se aplica un factor 1.25 porque en la ciudad
 * se camina por la vereda y en manzanas, no en línea recta.
 * @param {number} metros
 */
export function minutosCaminando(metros) {
  return Math.max(1, Math.round((metros * 1.25) / VELOCIDAD_CAMINANDO_M_POR_MIN));
}

/**
 * Caja de búsqueda aproximada (bounding box) para prefiltrar en SQL
 * antes de calcular la distancia exacta.
 * @param {number} lat
 * @param {number} lng
 * @param {number} radioMetros
 */
export function cajaDeBusqueda(lat, lng, radioMetros) {
  const deltaLat = (radioMetros / RADIO_TIERRA_M) * (180 / Math.PI);
  const deltaLng = deltaLat / Math.max(Math.cos(rad(lat)), 0.01);
  return {
    latMin: lat - deltaLat,
    latMax: lat + deltaLat,
    lngMin: lng - deltaLng,
    lngMax: lng + deltaLng,
  };
}

/** "436 m" / "1,2 km" */
export function formatearDistancia(metros) {
  if (metros < 1000) return `${metros} m`;
  return `${(metros / 1000).toFixed(1).replace('.', ',')} km`;
}
