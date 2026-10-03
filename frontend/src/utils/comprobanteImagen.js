/**
 * Genera el comprobante como imagen PNG descargable.
 *
 * Se dibuja a mano en un canvas en vez de usar html2canvas: sin dependencias,
 * sin sorpresas de renderizado y con control total del resultado. La imagen es
 * lo que el cliente va a guardar en el carrete del celular y mostrar al entrar,
 * así que lo que más importa es que el código y la patente se lean de lejos.
 */
import { precio as fmtPrecio, fechaLarga, hora, patente as fmtPatente } from './formato.js';

const ANCHO = 720;
const MARGEN = 48;

const COLOR = {
  tinta: '#0F172A',
  texto: '#334155',
  suave: '#64748B',
  tenue: '#94A3B8',
  // Espejo de --sn-accion (variables.css). El canvas no puede leer custom
  // properties, así que este valor se mantiene a mano si cambia la marca.
  marca: '#1177C5',
  borde: '#E2E8F0',
  fondo: '#FFFFFF',
};

const FUENTE = "'Plus Jakarta Sans', 'Segoe UI', system-ui, -apple-system, sans-serif";

/** Corta el texto con "..." si no entra en el ancho disponible. */
function recortar(ctx, texto, maxAncho) {
  let t = String(texto ?? '');
  if (ctx.measureText(t).width <= maxAncho) return t;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxAncho) t = t.slice(0, -1);
  return `${t}…`;
}

/** Rectángulo con esquinas redondeadas (roundRect no está en Safari viejo). */
function rectRedondeado(ctx, x, y, ancho, alto, radio) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, ancho, alto, radio);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + radio, y);
  ctx.arcTo(x + ancho, y, x + ancho, y + alto, radio);
  ctx.arcTo(x + ancho, y + alto, x, y + alto, radio);
  ctx.arcTo(x, y + alto, x, y, radio);
  ctx.arcTo(x, y, x + ancho, y, radio);
  ctx.closePath();
}

/** Carga una imagen (el QR viene como data URL, así que no hay CORS). */
function cargarImagen(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar el QR'));
    img.src = src;
  });
}

/**
 * @param {object} reserva  Comprobante público
 * @param {string|null} qrDataUrl
 * @returns {Promise<Blob>}
 */
export async function generarImagenComprobante(reserva, qrDataUrl) {
  const filas = [
    ['Estacionamiento', reserva.parking.nombre],
    ['Dirección', `${reserva.parking.direccion}${reserva.parking.barrio ? `, ${reserva.parking.barrio}` : ''}`],
    ['Ingreso', `${fechaLarga(reserva.inicio)} · ${hora(reserva.inicio)}`],
    ['Salida', `${fechaLarga(reserva.fin)} · ${hora(reserva.fin)}`],
    ['A nombre de', `${reserva.cliente.nombre} ${reserva.cliente.apellido}`],
    [
      'Vehículo',
      [reserva.vehiculo.marca, reserva.vehiculo.modelo].filter(Boolean).join(' ') || '—',
    ],
    ['Patente', fmtPatente(reserva.vehiculo.patente)],
    ['Total', fmtPrecio(reserva.precioTotal)],
  ];

  const ALTO_CABECERA = 120;
  const ALTO_QR = qrDataUrl ? 300 : 150;
  const ALTO_FILA = 46;
  const ALTO_PIE = 96;
  const alto = ALTO_CABECERA + ALTO_QR + filas.length * ALTO_FILA + ALTO_PIE + 40;

  // Se dibuja al doble de resolución para que no se vea borroso en pantallas
  // de alta densidad ni al imprimirlo.
  const escala = 2;
  const canvas = document.createElement('canvas');
  canvas.width = ANCHO * escala;
  canvas.height = alto * escala;
  const ctx = canvas.getContext('2d');
  ctx.scale(escala, escala);
  ctx.textBaseline = 'alphabetic';

  // ── Fondo ──
  ctx.fillStyle = COLOR.fondo;
  ctx.fillRect(0, 0, ANCHO, alto);

  // ── Cabecera ──
  ctx.fillStyle = COLOR.tinta;
  ctx.fillRect(0, 0, ANCHO, ALTO_CABECERA);

  // Pin de la marca
  ctx.fillStyle = COLOR.marca;
  ctx.beginPath();
  ctx.arc(MARGEN + 12, 50, 12, Math.PI, 0);
  ctx.lineTo(MARGEN + 12, 74);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLOR.tinta;
  ctx.beginPath();
  ctx.arc(MARGEN + 12, 48, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 30px ${FUENTE}`;
  ctx.fillText('SpotNear', MARGEN + 36, 58);

  ctx.fillStyle = '#94A3B8';
  ctx.font = `500 15px ${FUENTE}`;
  ctx.fillText('Comprobante de reserva', MARGEN + 36, 82);

  let y = ALTO_CABECERA + 44;

  // ── Código ──
  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR.suave;
  ctx.font = `600 13px ${FUENTE}`;
  ctx.fillText('CÓDIGO DE RESERVA', ANCHO / 2, y);

  y += 40;
  ctx.fillStyle = COLOR.tinta;
  ctx.font = `800 44px ${FUENTE}`;
  ctx.fillText(reserva.codigo, ANCHO / 2, y);

  // ── QR ──
  if (qrDataUrl) {
    y += 26;
    try {
      const img = await cargarImagen(qrDataUrl);
      const tam = 186;
      const x = (ANCHO - tam) / 2;

      ctx.strokeStyle = COLOR.borde;
      ctx.lineWidth = 1;
      rectRedondeado(ctx, x - 8, y - 8, tam + 16, tam + 16, 14);
      ctx.stroke();

      ctx.drawImage(img, x, y, tam, tam);
      y += tam + 30;
    } catch {
      // Sin QR igual sirve: el código alcanza para identificar la reserva.
      y += 20;
    }
  } else {
    y += 30;
  }

  ctx.fillStyle = COLOR.suave;
  ctx.font = `500 14px ${FUENTE}`;
  ctx.fillText('Presentá este comprobante al ingresar', ANCHO / 2, y);
  y += 34;

  // ── Detalle ──
  ctx.textAlign = 'left';
  const anchoEtiqueta = 190;

  for (const [etiqueta, valor] of filas) {
    ctx.strokeStyle = COLOR.borde;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGEN, y - 26);
    ctx.lineTo(ANCHO - MARGEN, y - 26);
    ctx.stroke();

    ctx.fillStyle = COLOR.suave;
    ctx.font = `500 15px ${FUENTE}`;
    ctx.fillText(etiqueta, MARGEN, y);

    ctx.fillStyle = COLOR.tinta;
    ctx.font = `700 15px ${FUENTE}`;
    ctx.textAlign = 'right';
    ctx.fillText(
      recortar(ctx, valor, ANCHO - MARGEN * 2 - anchoEtiqueta),
      ANCHO - MARGEN,
      y,
    );
    ctx.textAlign = 'left';

    y += ALTO_FILA;
  }

  // ── Pie ──
  ctx.strokeStyle = COLOR.borde;
  ctx.beginPath();
  ctx.moveTo(MARGEN, y - 22);
  ctx.lineTo(ANCHO - MARGEN, y - 22);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR.tenue;
  ctx.font = `500 13px ${FUENTE}`;
  ctx.fillText('Cancelación gratuita hasta la hora de inicio', ANCHO / 2, y + 10);
  ctx.fillText('SpotNear · Un producto de ColdevIA', ANCHO / 2, y + 34);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}

/** Descarga la imagen del comprobante. */
export async function descargarImagenComprobante(reserva, qrDataUrl) {
  const blob = await generarImagenComprobante(reserva, qrDataUrl);
  if (!blob) throw new Error('No se pudo generar la imagen');

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `spotnear-${reserva.codigo}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
