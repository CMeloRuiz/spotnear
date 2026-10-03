/**
 * Formateo para mostrar en pantalla.
 * Todo en español de Argentina: fechas dd/mm/aaaa, horas de 24, precios $12.000.
 */

export const ZONA = 'America/Argentina/Buenos_Aires';

/* ─────────────────────────── Dinero ─────────────────────────── */

/**
 * $12.000 · sin decimales si son redondos.
 * @param {number} valor
 */
export function precio(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '—';
  const tieneCentavos = Math.abs(n % 1) > 0.001;
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: tieneCentavos ? 2 : 0,
    maximumFractionDigits: tieneCentavos ? 2 : 0,
  })
    .format(n)
    // Intl en es-AR mete un espacio duro entre el $ y el número.
    .replace(/^(\$)\s*/u, '$1')
    .replace(/\u00a0/g, ' ');
}

/** 12.000 (sin el signo), para cuando el $ va aparte. */
export function numero(valor, decimales = 0) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(n);
}

/* ─────────────────────────── Fechas ─────────────────────────── */

const aFecha = (v) => (v instanceof Date ? v : new Date(v));

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** dd/mm/aaaa */
export function fecha(valor) {
  const d = aFecha(valor);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** dd/mm */
export function fechaCorta(valor) {
  const d = aFecha(valor);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** HH:mm en formato de 24 horas */
export function hora(valor) {
  const d = aFecha(valor);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** dd/mm/aaaa HH:mm */
export function fechaHora(valor) {
  return `${fecha(valor)} ${hora(valor)}`;
}

/** "Sábado 25/10" */
export function fechaLarga(valor) {
  const d = aFecha(valor);
  if (Number.isNaN(d.getTime())) return '—';
  return `${DIAS[d.getDay()]} ${fechaCorta(d)}`;
}

/** "25 de octubre" */
export function fechaConMes(valor) {
  const d = aFecha(valor);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/** "Hoy 19:00" / "Mañana 19:00" / "Sáb 25/10 19:00" */
export function fechaRelativa(valor) {
  const d = aFecha(valor);
  if (Number.isNaN(d.getTime())) return '—';

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dia = new Date(d);
  dia.setHours(0, 0, 0, 0);

  const diff = Math.round((dia - hoy) / 86_400_000);

  if (diff === 0) return `Hoy ${hora(d)}`;
  if (diff === 1) return `Mañana ${hora(d)}`;
  if (diff === -1) return `Ayer ${hora(d)}`;
  return `${DIAS_CORTOS[d.getDay()]} ${fechaCorta(d)} ${hora(d)}`;
}

/** "5 h 30 min" */
export function duracion(desde, hasta) {
  const min = Math.max(0, Math.round((aFecha(hasta) - aFecha(desde)) / 60_000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/**
 * Valor para un <input type="datetime-local">.
 * El input trabaja en hora local, así que NO se puede usar toISOString().
 */
export function paraInputDateTime(valor) {
  const d = aFecha(valor);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Valor para un <input type="date"> */
export function paraInputDate(valor) {
  const d = aFecha(valor);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ─────────────────────────── Datos del dominio ─────────────────────────── */

/** "AB 123 CD" / "ABC 123" */
export function patente(valor) {
  const p = String(valor ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(p)) return `${p.slice(0, 2)} ${p.slice(2, 5)} ${p.slice(5)}`;
  if (/^[A-Z]{3}\d{3}$/.test(p)) return `${p.slice(0, 3)} ${p.slice(3)}`;
  if (/^\d{3}[A-Z]{3}$/.test(p)) return `${p.slice(0, 3)} ${p.slice(3)}`;
  if (/^[A-Z]\d{3}[A-Z]{3}$/.test(p)) return `${p.slice(0, 1)} ${p.slice(1, 4)} ${p.slice(4)}`;
  return p;
}

/** "+54 9 11 1234-5678" */
export function telefono(valor) {
  const d = String(valor ?? '').replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('549')) {
    const n = d.slice(3);
    return `+54 9 ${n.slice(0, 2)} ${n.slice(2, 6)}-${n.slice(6)}`;
  }
  if (d.length === 12 && d.startsWith('54')) {
    const n = d.slice(2);
    return `+54 ${n.slice(0, 2)} ${n.slice(2, 6)}-${n.slice(6)}`;
  }
  return valor ?? '';
}

/** "436 m" / "1,2 km" */
export function distancia(metros) {
  const m = Number(metros);
  if (!Number.isFinite(m)) return '';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

/** "4,7" — la calificación se escribe con coma */
export function calificacion(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(1).replace('.', ',');
}

/** "3.1K" para la cantidad de reseñas */
export function cantidadCompacta(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '0';
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1).replace('.0', '').replace('.', ',')}K`;
}

/** Primera letra en mayúscula. */
export function capitalizar(texto) {
  const t = String(texto ?? '');
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/** "Toyota Corolla" a partir del objeto vehículo. */
export function vehiculo(v) {
  if (!v) return '';
  return [v.marca, v.modelo].filter(Boolean).join(' ');
}

/** Nombre completo del cliente. */
export function nombreCompleto(c) {
  if (!c) return '';
  return [c.nombre, c.apellido].filter(Boolean).join(' ');
}

export { DIAS, DIAS_CORTOS, MESES };
