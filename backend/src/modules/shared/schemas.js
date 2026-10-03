/**
 * Piezas de validación reutilizables (Zod).
 * Los mensajes están en español porque llegan tal cual al formulario.
 */
import { z } from 'zod';
import { validarPatente, MENSAJE_PATENTE_INVALIDA } from '../../utils/patente.js';
import { normalizarTelefono, MENSAJE_TELEFONO_INVALIDO } from '../../utils/phone.js';

/** Texto obligatorio con trim y largo máximo. */
export const texto = (max = 120, etiqueta = 'Este campo') =>
  z
    .string({ required_error: `${etiqueta} es obligatorio.`, invalid_type_error: `${etiqueta} debe ser texto.` })
    .trim()
    .min(1, `${etiqueta} es obligatorio.`)
    .max(max, `${etiqueta} no puede superar los ${max} caracteres.`);

/** Texto opcional: '' se convierte en undefined para no guardar vacíos. */
export const textoOpcional = (max = 240) =>
  z
    .string()
    .trim()
    .max(max, `No puede superar los ${max} caracteres.`)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' || v === undefined ? undefined : v));

/** Patente argentina: se valida y se guarda normalizada en mayúsculas. */
export const patente = z
  .string({ required_error: 'La patente es obligatoria.' })
  .trim()
  .min(1, 'La patente es obligatoria.')
  .transform((v) => validarPatente(v))
  .refine((r) => r.valida, { message: MENSAJE_PATENTE_INVALIDA })
  .transform((r) => r.patente);

/** Teléfono argentino: se valida y se guarda en E.164. */
export const telefono = z
  .string({ required_error: 'El teléfono es obligatorio.' })
  .trim()
  .min(1, 'El teléfono es obligatorio.')
  .transform((v) => normalizarTelefono(v))
  .refine((r) => r.valido, { message: MENSAJE_TELEFONO_INVALIDO })
  .transform((r) => r.e164);

/** Email opcional, normalizado a minúsculas. */
export const emailOpcional = z
  .string()
  .trim()
  .toLowerCase()
  .email('El email no tiene un formato válido.')
  .optional()
  .or(z.literal(''))
  .transform((v) => (v === '' || v === undefined ? undefined : v));

export const email = z
  .string({ required_error: 'El email es obligatorio.' })
  .trim()
  .toLowerCase()
  .email('El email no tiene un formato válido.');

export const password = z
  .string({ required_error: 'La contraseña es obligatoria.' })
  .min(8, 'La contraseña tiene que tener al menos 8 caracteres.')
  .max(128, 'La contraseña es demasiado larga.');

/** Fecha ISO que llega como string y sale como Date. */
export const fechaISO = (etiqueta = 'La fecha') =>
  z
    .string({ required_error: `${etiqueta} es obligatoria.` })
    .datetime({ offset: true, message: `${etiqueta} debe estar en formato ISO 8601.` })
    .transform((v) => new Date(v))
    .or(z.date());

export const fechaISOOpcional = z
  .string()
  .datetime({ offset: true })
  .transform((v) => new Date(v))
  .optional();

export const cuid = (etiqueta = 'El identificador') =>
  z.string({ required_error: `${etiqueta} es obligatorio.` }).trim().min(1, `${etiqueta} es obligatorio.`);

export const vehicleType = z.enum(['AUTO', 'CAMIONETA', 'SUV', 'MOTO', 'UTILITARIO'], {
  errorMap: () => ({ message: 'Elegí un tipo de vehículo válido.' }),
});

export const reservationStatus = z.enum([
  'PENDIENTE',
  'CONFIRMADA',
  'EN_CURSO',
  'FINALIZADA',
  'CANCELADA',
  'NO_SHOW',
]);

export const rateType = z.enum(['HORA', 'DIA', 'MENSUAL']);

export const role = z.enum(['SUPERADMIN', 'OWNER', 'STAFF']);

/** Paginación estándar de los listados del panel. */
export const paginacion = {
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
};

/** Coordenada geográfica. */
export const latitud = z.coerce
  .number({ required_error: 'Falta la latitud.' })
  .min(-90, 'Latitud fuera de rango.')
  .max(90, 'Latitud fuera de rango.');

export const longitud = z.coerce
  .number({ required_error: 'Falta la longitud.' })
  .min(-180, 'Longitud fuera de rango.')
  .max(180, 'Longitud fuera de rango.');

export const dinero = z.coerce
  .number({ invalid_type_error: 'El importe debe ser un número.' })
  .min(0, 'El importe no puede ser negativo.')
  .max(99_999_999, 'El importe es demasiado alto.');

/**
 * Valida que el rango de fechas tenga sentido.
 * Se usa con .superRefine en los esquemas que reciben inicio y fin.
 */
export function validarRango(datos, ctx, { maxDias = 90 } = {}) {
  if (!datos.inicio || !datos.fin) return;
  if (datos.fin <= datos.inicio) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fin'],
      message: 'La hora de salida tiene que ser posterior a la de ingreso.',
    });
    return;
  }
  const dias = (datos.fin - datos.inicio) / 86_400_000;
  if (dias > maxDias) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fin'],
      message: `La reserva no puede superar los ${maxDias} días.`,
    });
  }
}

export { z };
