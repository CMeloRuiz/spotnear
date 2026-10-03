/**
 * Comprobante de reserva como imagen PNG, generada en el servidor.
 *
 * Por qué existe: el link `wa.me` solo puede llevar texto prellenado, no puede
 * adjuntar archivos. Para que el cliente reciba el comprobante *visual* y no un
 * bloque de datos sueltos, la imagen tiene que vivir en una URL pública que el
 * mensaje pueda enlazar (modo link) o que Meta pueda descargar y adjuntar como
 * media (modo cloud_api). El PNG del navegador no sirve para eso: se dibuja en
 * un canvas del cliente y no existe del lado del servidor.
 *
 * Cómo se dibuja: se arma un SVG a mano y lo rasteriza `sharp`. Se eligió SVG
 * sobre un canvas nativo o puppeteer porque no necesita un Chromium de 300 MB
 * ni compilar bindings: `sharp` ya trae binarios precompilados.
 *
 * El diseño es el mismo que el de la pantalla web y el del PNG descargable
 * (`frontend/src/utils/comprobanteImagen.js`): cabecera oscura con la marca,
 * código grande, QR, y los datos debajo. Si cambia uno, conviene mirar el otro.
 */
import sharp from 'sharp';
import { qrBuffer } from './qr.js';
import { formatearARS } from '../utils/money.js';
import { formatearTelefono } from '../utils/phone.js';

const ANCHO = 720;
const MARGEN = 48;
const ALTO_CABECERA = 120;
const ALTO_QR = 300;
const ALTO_FILA = 46;
// La fila del total lleva una segunda línea ("✓ Pagado") debajo del monto: son
// 22 px extra que hay que contemplar en el alto total del lienzo.
const EXTRA_TOTAL = 22;
const ALTO_PIE = 130;

const COLOR = {
  tinta: '#0F172A',
  texto: '#334155',
  suave: '#64748B',
  tenue: '#94A3B8',
  // Espejo de --sn-accion (variables.css). El SVG no puede leer custom
  // properties, así que este valor se mantiene a mano si cambia la marca.
  marca: '#1177C5',
  verde: '#15803D',
  borde: '#E2E8F0',
  fondo: '#FFFFFF',
};

// Sin webfonts: el rasterizador usa las fuentes del sistema donde corre el
// servidor, así que se listan alternativas de Windows, macOS y Linux.
const FUENTE = "'Segoe UI','Helvetica Neue',Helvetica,Arial,DejaVu Sans,sans-serif";
const FUENTE_MONO = "'Consolas','SF Mono','DejaVu Sans Mono',monospace";

/** Escapa lo que se interpola dentro del SVG: los datos vienen del cliente. */
function esc(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Corta por cantidad de caracteres: el SVG no puede medir texto. */
function recortar(texto, maxCaracteres) {
  const t = String(texto ?? '');
  return t.length > maxCaracteres ? `${t.slice(0, maxCaracteres - 1)}…` : t;
}

const ZONA = 'America/Argentina/Buenos_Aires';

const FORMATO_FECHA = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA,
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** "Sábado 26/09 · 23:30", en hora de Buenos Aires. */
function fechaYHora(valor) {
  const p = Object.fromEntries(
    FORMATO_FECHA.formatToParts(new Date(valor)).map((x) => [x.type, x.value]),
  );
  // es-AR devuelve el día en minúscula ("sábado"); acá va con mayúscula.
  const dia = p.weekday ? p.weekday[0].toUpperCase() + p.weekday.slice(1) : '';
  return `${dia} ${p.day}/${p.month} · ${p.hour}:${p.minute}`;
}

/** Patente legible: AB 123 CD o ABC 123. */
function formatearPatente(patente) {
  const p = String(patente ?? '').toUpperCase().replace(/\s/g, '');
  if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(p)) return `${p.slice(0, 2)} ${p.slice(2, 5)} ${p.slice(5)}`;
  if (/^[A-Z]{3}\d{3}$/.test(p)) return `${p.slice(0, 3)} ${p.slice(3)}`;
  return p;
}

/** Las filas de datos del comprobante, en orden. */
function filasDe(reserva) {
  const parking = reserva.parking ?? {};
  const cliente = reserva.customer ?? {};
  const vehiculo = reserva.vehicle ?? {};

  const direccion = [parking.direccion, parking.barrio].filter(Boolean).join(', ');
  const modelo = [vehiculo.marca, vehiculo.modelo].filter(Boolean).join(' ') || '—';

  return [
    ['Estacionamiento', parking.nombre],
    ['Dirección', direccion],
    ['Ingreso', fechaYHora(reserva.inicio)],
    ['Salida', fechaYHora(reserva.fin)],
    // El nombre sale de la copia congelada en la reserva, no del contacto:
    // ese lo comparten todas las reservas del mismo teléfono.
    [
      'A nombre de',
      `${reserva.clienteNombre ?? cliente.nombre ?? ''} ${reserva.clienteApellido ?? cliente.apellido ?? ''}`.trim(),
    ],
    ['Teléfono', formatearTelefono(cliente.telefono)],
    ['Vehículo', modelo],
    ['Patente', formatearPatente(vehiculo.patente)],
    // Los tres montos del modelo de seña: lo que se paga allá, lo que ya se
    // pagó acá, y el total. Nunca la palabra "comisión": esto lo ve el cliente.
    ['A pagar en el estacionamiento', formatearARS(reserva.montoNeto ?? reserva.subtotal)],
    ['Seña (ya pagada)', formatearARS(reserva.montoComision ?? 0)],
    ['Total', formatearARS(reserva.precioTotal)],
  ];
}

/**
 * Arma el SVG del comprobante.
 * @param {object} reserva  Con parking, customer y vehicle incluidos
 * @param {string} qrBase64 PNG del QR en base64 (sin el prefijo data:)
 * @returns {string}
 */
export function comprobanteSvg(reserva, qrBase64) {
  const filas = filasDe(reserva);
  const alto = ALTO_CABECERA + ALTO_QR + filas.length * ALTO_FILA + EXTRA_TOTAL + ALTO_PIE + 40;

  const centro = ANCHO / 2;
  let y = ALTO_CABECERA + 44;

  const piezas = [];

  // ── Cabecera oscura con la marca ──
  piezas.push(`<rect width="${ANCHO}" height="${ALTO_CABECERA}" fill="${COLOR.tinta}"/>`);
  // Pin: semicírculo + punta, igual que el logo.
  piezas.push(
    `<path d="M${MARGEN} 50 a12 12 0 0 1 24 0 l-12 24 z" fill="${COLOR.marca}"/>`,
    `<circle cx="${MARGEN + 12}" cy="48" r="5" fill="${COLOR.tinta}"/>`,
    `<text x="${MARGEN + 36}" y="58" font-family="${FUENTE}" font-size="30" font-weight="800" fill="#FFFFFF">SpotNear</text>`,
    `<text x="${MARGEN + 36}" y="82" font-family="${FUENTE}" font-size="15" font-weight="500" fill="${COLOR.tenue}">Comprobante de reserva</text>`,
  );

  // ── Código de reserva ──
  piezas.push(
    `<text x="${centro}" y="${y}" text-anchor="middle" font-family="${FUENTE}" font-size="13" font-weight="700" letter-spacing="2" fill="${COLOR.tenue}">CÓDIGO DE RESERVA</text>`,
  );
  y += 44;
  piezas.push(
    `<text x="${centro}" y="${y}" text-anchor="middle" font-family="${FUENTE_MONO}" font-size="40" font-weight="700" letter-spacing="3" fill="${COLOR.tinta}">${esc(reserva.codigo)}</text>`,
  );
  y += 28;

  // ── QR ──
  if (qrBase64) {
    const lado = 176;
    piezas.push(
      `<image x="${centro - lado / 2}" y="${y}" width="${lado}" height="${lado}" href="data:image/png;base64,${qrBase64}"/>`,
    );
    y += lado + 26;
  }

  piezas.push(
    `<text x="${centro}" y="${y}" text-anchor="middle" font-family="${FUENTE}" font-size="14" fill="${COLOR.suave}">Presentá este comprobante al ingresar</text>`,
  );
  y += 34;

  // ── Filas de datos ──
  for (const [etiqueta, valor] of filas) {
    const esTotal = etiqueta === 'Total';
    // La seña es la única que ya está cobrada: el resto se paga en el lugar.
    const esSena = etiqueta.startsWith('Seña');
    piezas.push(`<line x1="${MARGEN}" y1="${y}" x2="${ANCHO - MARGEN}" y2="${y}" stroke="${COLOR.borde}" stroke-width="1"/>`);
    const base = y + 30;
    piezas.push(
      `<text x="${MARGEN}" y="${base}" font-family="${FUENTE}" font-size="15" fill="${COLOR.suave}">${esc(etiqueta)}</text>`,
    );

    if (esSena) {
      piezas.push(
        `<text x="${ANCHO - MARGEN}" y="${base}" text-anchor="end" font-family="${FUENTE}" font-size="16" font-weight="600" fill="${COLOR.tinta}">${esc(valor)}</text>`,
        `<text x="${ANCHO - MARGEN}" y="${base + 20}" text-anchor="end" font-family="${FUENTE}" font-size="13" font-weight="700" fill="${COLOR.verde}">✓ Pagada</text>`,
      );
    } else if (esTotal) {
      piezas.push(
        `<text x="${ANCHO - MARGEN}" y="${base}" text-anchor="end" font-family="${FUENTE}" font-size="18" font-weight="800" fill="${COLOR.tinta}">${esc(valor)}</text>`,
      );
    } else {
      piezas.push(
        `<text x="${ANCHO - MARGEN}" y="${base}" text-anchor="end" font-family="${FUENTE}" font-size="16" font-weight="600" fill="${COLOR.tinta}">${esc(recortar(valor, 42))}</text>`,
      );
    }
    // La fila de la seña ocupa dos renglones (monto y "Pagada" debajo).
    y += esSena ? ALTO_FILA + 22 : ALTO_FILA;
  }

  // ── Pie ──
  piezas.push(`<line x1="${MARGEN}" y1="${y}" x2="${ANCHO - MARGEN}" y2="${y}" stroke="${COLOR.borde}" stroke-width="1"/>`);
  y += 48;
  piezas.push(
    `<text x="${centro}" y="${y}" text-anchor="middle" font-family="${FUENTE}" font-size="13" fill="${COLOR.tenue}">La seña no es reembolsable · El resto se paga en el estacionamiento</text>`,
    `<text x="${centro}" y="${y + 22}" text-anchor="middle" font-family="${FUENTE}" font-size="13" fill="${COLOR.tenue}">SpotNear · Un producto de ColdevIA</text>`,
  );

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${alto}" viewBox="0 0 ${ANCHO} ${alto}">`,
    `<rect width="${ANCHO}" height="${alto}" fill="${COLOR.fondo}"/>`,
    ...piezas,
    '</svg>',
  ].join('');
}

/**
 * PNG del comprobante, listo para servir o adjuntar.
 *
 * Se dibuja al doble de resolución para que se lea bien en pantallas densas y
 * al imprimirlo: lo que más importa es que el código y la patente se lean.
 *
 * @param {object} reserva Con parking, customer y vehicle incluidos
 * @returns {Promise<Buffer>}
 */
export async function comprobantePng(reserva) {
  const qr = await qrBuffer(reserva).catch(() => null);
  const svg = comprobanteSvg(reserva, qr ? qr.toString('base64') : null);

  return sharp(Buffer.from(svg), { density: 144 })
    .resize({ width: ANCHO * 2 })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

export default { comprobantePng, comprobanteSvg };
