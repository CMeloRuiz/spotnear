/**
 * Lugares de Buenos Aires con coordenadas.
 *
 * Cumplen dos funciones:
 *  1. Accesos rápidos en el buscador ("Movistar Arena", "Obelisco").
 *  2. Respaldo del autocompletado cuando no hay API key de Google o cuando
 *     Places no responde. Sin esto, sin key la app no se podría usar.
 */

export const LUGARES = [
  // ── Estadios y centros de eventos ──
  {
    id: 'movistar-arena',
    nombre: 'Movistar Arena',
    detalle: 'Humboldt 450, Villa Crespo',
    lat: -34.5965,
    lng: -58.4489,
    tipo: 'evento',
    destacado: true,
  },
  {
    id: 'luna-park',
    nombre: 'Luna Park',
    detalle: 'Av. Madero 420, San Nicolás',
    lat: -34.6023,
    lng: -58.3684,
    tipo: 'evento',
    destacado: true,
  },
  {
    id: 'estadio-monumental',
    nombre: 'Estadio Más Monumental',
    detalle: 'Av. Figueroa Alcorta 7597, Núñez',
    lat: -34.5453,
    lng: -58.4497,
    tipo: 'evento',
    destacado: true,
  },
  {
    id: 'la-bombonera',
    nombre: 'La Bombonera',
    detalle: 'Brandsen 805, La Boca',
    lat: -34.6356,
    lng: -58.3648,
    tipo: 'evento',
  },
  {
    id: 'teatro-colon',
    nombre: 'Teatro Colón',
    detalle: 'Cerrito 628, San Nicolás',
    lat: -34.6011,
    lng: -58.3835,
    tipo: 'evento',
  },
  {
    id: 'la-rural',
    nombre: 'La Rural',
    detalle: 'Av. Sarmiento 2704, Palermo',
    lat: -34.5776,
    lng: -58.4176,
    tipo: 'evento',
  },
  {
    id: 'hipodromo-palermo',
    nombre: 'Hipódromo de Palermo',
    detalle: 'Av. del Libertador 4101, Palermo',
    lat: -34.5717,
    lng: -58.4253,
    tipo: 'evento',
  },
  {
    id: 'estadio-obras',
    nombre: 'Estadio Obras Sanitarias',
    detalle: 'Av. del Libertador 7395, Núñez',
    lat: -34.5461,
    lng: -58.4568,
    tipo: 'evento',
  },
  {
    id: 'centro-costa-salguero',
    nombre: 'Costa Salguero',
    detalle: 'Av. Rafael Obligado, Palermo',
    lat: -34.5663,
    lng: -58.3961,
    tipo: 'evento',
  },

  // ── Barrios ──
  { id: 'villa-crespo', nombre: 'Villa Crespo', detalle: 'CABA', lat: -34.5985, lng: -58.4402, tipo: 'barrio' },
  { id: 'palermo', nombre: 'Palermo', detalle: 'CABA', lat: -34.5889, lng: -58.4265, tipo: 'barrio' },
  { id: 'palermo-soho', nombre: 'Palermo Soho', detalle: 'Palermo, CABA', lat: -34.5883, lng: -58.4272, tipo: 'barrio' },
  { id: 'palermo-hollywood', nombre: 'Palermo Hollywood', detalle: 'Palermo, CABA', lat: -34.5807, lng: -58.4372, tipo: 'barrio' },
  { id: 'chacarita', nombre: 'Chacarita', detalle: 'CABA', lat: -34.5872, lng: -58.4534, tipo: 'barrio' },
  { id: 'colegiales', nombre: 'Colegiales', detalle: 'CABA', lat: -34.5754, lng: -58.4497, tipo: 'barrio' },
  { id: 'almagro', nombre: 'Almagro', detalle: 'CABA', lat: -34.6063, lng: -58.4200, tipo: 'barrio' },
  { id: 'caballito', nombre: 'Caballito', detalle: 'CABA', lat: -34.6187, lng: -58.4405, tipo: 'barrio' },
  { id: 'recoleta', nombre: 'Recoleta', detalle: 'CABA', lat: -34.5875, lng: -58.3974, tipo: 'barrio' },
  { id: 'belgrano', nombre: 'Belgrano', detalle: 'CABA', lat: -34.5626, lng: -58.4563, tipo: 'barrio' },
  { id: 'nunez', nombre: 'Núñez', detalle: 'CABA', lat: -34.5451, lng: -58.4610, tipo: 'barrio' },
  { id: 'san-telmo', nombre: 'San Telmo', detalle: 'CABA', lat: -34.6212, lng: -58.3731, tipo: 'barrio' },
  { id: 'puerto-madero', nombre: 'Puerto Madero', detalle: 'CABA', lat: -34.6106, lng: -58.3628, tipo: 'barrio' },
  { id: 'microcentro', nombre: 'Microcentro', detalle: 'San Nicolás, CABA', lat: -34.6037, lng: -58.3795, tipo: 'barrio' },
  { id: 'villa-urquiza', nombre: 'Villa Urquiza', detalle: 'CABA', lat: -34.5729, lng: -58.4913, tipo: 'barrio' },
  { id: 'flores', nombre: 'Flores', detalle: 'CABA', lat: -34.6281, lng: -58.4628, tipo: 'barrio' },
  { id: 'boedo', nombre: 'Boedo', detalle: 'CABA', lat: -34.6297, lng: -58.4155, tipo: 'barrio' },
  { id: 'la-boca', nombre: 'La Boca', detalle: 'CABA', lat: -34.6345, lng: -58.3631, tipo: 'barrio' },
  { id: 'barracas', nombre: 'Barracas', detalle: 'CABA', lat: -34.6459, lng: -58.3784, tipo: 'barrio' },
  { id: 'retiro', nombre: 'Retiro', detalle: 'CABA', lat: -34.5919, lng: -58.3747, tipo: 'barrio' },

  // ── Puntos de referencia ──
  { id: 'obelisco', nombre: 'Obelisco', detalle: 'Av. 9 de Julio, San Nicolás', lat: -34.6037, lng: -58.3816, tipo: 'lugar', destacado: true },
  { id: 'aeroparque', nombre: 'Aeroparque Jorge Newbery', detalle: 'Av. Costanera Rafael Obligado', lat: -34.5592, lng: -58.4156, tipo: 'lugar' },
  { id: 'retiro-terminal', nombre: 'Terminal de Ómnibus de Retiro', detalle: 'Av. Antártida Argentina, Retiro', lat: -34.5895, lng: -58.3738, tipo: 'lugar' },
  { id: 'congreso', nombre: 'Congreso de la Nación', detalle: 'Av. Entre Ríos 51, Balvanera', lat: -34.6098, lng: -58.3926, tipo: 'lugar' },
  { id: 'casa-rosada', nombre: 'Casa Rosada', detalle: 'Balcarce 50, Monserrat', lat: -34.6083, lng: -58.3705, tipo: 'lugar' },
  { id: 'alto-palermo', nombre: 'Alto Palermo Shopping', detalle: 'Av. Santa Fe 3253, Palermo', lat: -34.5883, lng: -58.4106, tipo: 'lugar' },
  { id: 'abasto', nombre: 'Abasto Shopping', detalle: 'Av. Corrientes 3247, Balvanera', lat: -34.6036, lng: -58.4108, tipo: 'lugar' },
  { id: 'hospital-italiano', nombre: 'Hospital Italiano', detalle: 'Perón 4190, Almagro', lat: -34.6058, lng: -58.4270, tipo: 'lugar' },
  { id: 'facultad-medicina', nombre: 'Facultad de Medicina (UBA)', detalle: 'Paraguay 2155, Recoleta', lat: -34.5985, lng: -58.3977, tipo: 'lugar' },
  { id: 'ciudad-universitaria', nombre: 'Ciudad Universitaria', detalle: 'Intendente Güiraldes 2160, Núñez', lat: -34.5427, lng: -58.4419, tipo: 'lugar' },
];

/** Los que se ofrecen antes de que el usuario escriba nada. */
export const DESTACADOS = LUGARES.filter((l) => l.destacado);

/** Centro de la ciudad: punto de partida del mapa cuando no hay nada elegido. */
export const CENTRO_CABA = { lat: -34.6037, lng: -58.3816 };

const sinAcentos = (t) =>
  String(t ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/**
 * Busca en la lista local. Se ignoran acentos y mayúsculas porque nadie
 * escribe "Núñez" con tilde cuando está apurado.
 * @param {string} termino
 * @param {number} [limite=6]
 */
export function buscarLugares(termino, limite = 6) {
  const q = sinAcentos(termino).trim();
  if (q.length < 2) return DESTACADOS.slice(0, limite);

  const puntuados = LUGARES.map((lugar) => {
    const nombre = sinAcentos(lugar.nombre);
    const detalle = sinAcentos(lugar.detalle);

    let puntos = 0;
    if (nombre.startsWith(q)) puntos = 100;
    else if (nombre.includes(q)) puntos = 60;
    else if (detalle.includes(q)) puntos = 30;

    if (puntos > 0 && lugar.destacado) puntos += 5;
    return { lugar, puntos };
  })
    .filter((x) => x.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos);

  return puntuados.slice(0, limite).map((x) => x.lugar);
}

/**
 * Sedes habilitadas en la pestaña "Eventos" del buscador.
 *
 * Por ahora es una sola, pero el desplegable se arma recorriendo esta lista:
 * **para sumar una sede alcanza con agregar su `id` acá**, siempre que el lugar
 * ya exista en `LUGARES` (que es de donde salen las coordenadas). No hay que
 * tocar el componente.
 *
 * Los estadios y teatros ya cargados en LUGARES llevan `tipo: 'evento'`, así
 * que los ids disponibles se ven filtrando por eso: movistar-arena, luna-park,
 * estadio-monumental, estadio-boca, estadio-velez, estadio-obras, entre otros.
 */
const SEDES_HABILITADAS = ['movistar-arena'];

export const SEDES_DE_EVENTOS = SEDES_HABILITADAS.map((id) =>
  LUGARES.find((l) => l.id === id),
).filter(Boolean);
