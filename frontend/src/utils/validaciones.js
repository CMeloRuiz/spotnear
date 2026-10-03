/**
 * Validaciones de formulario, del lado del cliente.
 *
 * Duplican a propósito las reglas del backend (backend/src/utils/*): el
 * servidor sigue siendo la única fuente de verdad y vuelve a validar todo,
 * pero acá le avisamos al usuario mientras escribe, sin ida y vuelta de red.
 * Si cambia una regla, hay que tocar los dos lados.
 */
import textos from '../i18n/textos.js';

/* ─────────────────────────── Patente ─────────────────────────── */

const FORMATOS_PATENTE = [
  /^[A-Z]{3}\d{3}$/, // ABC123 (viejo)
  /^[A-Z]{2}\d{3}[A-Z]{2}$/, // AB123CD (Mercosur)
  /^\d{3}[A-Z]{3}$/, // 123ABC (moto vieja)
  /^[A-Z]\d{3}[A-Z]{3}$/, // A123BCD (moto Mercosur)
];

export function normalizarPatente(valor) {
  return String(valor ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

export function esPatenteValida(valor) {
  const p = normalizarPatente(valor);
  return FORMATOS_PATENTE.some((r) => r.test(p));
}

/* ─────────────────────────── Teléfono ─────────────────────────── */

/**
 * Misma lógica que backend/src/utils/phone.js.
 * Devuelve el número en E.164 o null si no es válido.
 */
export function normalizarTelefono(valor) {
  let d = String(valor ?? '').replace(/\D/g, '');
  if (!d) return null;

  if (d.startsWith('00')) d = d.slice(2);

  if (d.startsWith('54') && d.length > 10) {
    d = d.slice(2);
    if (d.startsWith('9') && d.length > 10) d = d.slice(1);
  }
  if (d.startsWith('0')) d = d.slice(1);

  // El 15 de la marcación vieja: con él el número nacional queda en 12 dígitos
  if (d.length === 12) {
    if (d.slice(0, 2) === '11' && d.slice(2, 4) === '15') d = d.slice(0, 2) + d.slice(4);
    else if (d.slice(3, 5) === '15') d = d.slice(0, 3) + d.slice(5);
    else if (d.slice(4, 6) === '15') d = d.slice(0, 4) + d.slice(6);
  }

  // Solo el abonado de CABA: asumimos área 11
  if (d.length === 8) d = '11' + d;
  if (d.length === 10 && d.startsWith('15')) d = '11' + d.slice(2);

  if (d.length !== 10) return null;
  if (d.startsWith('0') || (d.startsWith('1') && !d.startsWith('11'))) return null;

  return `+549${d}`;
}

export function esTelefonoValido(valor) {
  return normalizarTelefono(valor) !== null;
}

/* ─────────────────────────── Otros ─────────────────────────── */

export function esEmailValido(valor) {
  const v = String(valor ?? '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

/* ─────────────────────────── Validadores de formulario ─────────────────────────── */

/**
 * Valida los datos del checkout.
 * @param {object} datos
 * @param {Array} [camposExtra] Configuración de campos del estacionamiento
 * @returns {Record<string, string>} errores por campo (vacío = todo bien)
 */
export function validarReserva(datos, camposExtra = []) {
  const e = {};
  const { errores } = textos;

  if (!datos.nombre?.trim()) e.nombre = errores.campoObligatorio;
  else if (datos.nombre.trim().length < 2) e.nombre = 'Escribí al menos 2 caracteres';

  if (!datos.apellido?.trim()) e.apellido = errores.campoObligatorio;
  else if (datos.apellido.trim().length < 2) e.apellido = 'Escribí al menos 2 caracteres';

  if (!datos.telefono?.trim()) e.telefono = errores.campoObligatorio;
  else if (!esTelefonoValido(datos.telefono)) e.telefono = errores.telefonoInvalido;

  if (datos.email?.trim() && !esEmailValido(datos.email)) e.email = errores.emailInvalido;

  if (!datos.patente?.trim()) e.patente = errores.campoObligatorio;
  else if (!esPatenteValida(datos.patente)) e.patente = errores.patenteInvalida;

  if (!datos.tipoVehiculo) e.tipoVehiculo = errores.campoObligatorio;

  if (datos.cantidadVehiculos !== undefined) {
    const n = Number(datos.cantidadVehiculos);
    if (!Number.isInteger(n) || n < 1 || n > 20) {
      e.cantidadVehiculos = 'Tiene que ser un número entre 1 y 20';
    }
  }

  // Campos configurados por el estacionamiento
  for (const campo of camposExtra) {
    const valor = datos.camposExtra?.[campo.key];
    const vacio = valor === undefined || valor === null || valor === '';

    if (campo.requerido && vacio) {
      e[`extra.${campo.key}`] = `${campo.label} es obligatorio`;
    } else if (!vacio && campo.tipo === 'NUMERO' && Number.isNaN(Number(valor))) {
      e[`extra.${campo.key}`] = 'Tiene que ser un número';
    }
  }

  return e;
}

/** Valida el login del panel. */
export function validarLogin(datos) {
  const e = {};
  if (!datos.email?.trim()) e.email = textos.errores.campoObligatorio;
  else if (!esEmailValido(datos.email)) e.email = textos.errores.emailInvalido;
  if (!datos.password) e.password = textos.errores.campoObligatorio;
  return e;
}

/** Valida el rango de fechas de una búsqueda o reserva. */
export function validarRango(inicio, fin) {
  if (!inicio || !fin) return textos.errores.campoObligatorio;
  const a = new Date(inicio);
  const b = new Date(fin);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return textos.errores.fechaInvalida;
  if (b <= a) return textos.errores.finAntesQueInicio;
  if ((b - a) / 86_400_000 > 90) return 'La reserva no puede superar los 90 días';
  return null;
}

/** ¿El objeto de errores está vacío? */
export function sinErrores(errores) {
  return Object.keys(errores).length === 0;
}
