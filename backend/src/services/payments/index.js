/**
 * Capa de pagos.
 *
 * Se cobra ÚNICAMENTE LA SEÑA: el 10% de la tarifa, que el cliente paga online
 * para apartar el lugar y que no se devuelve. El resto de la tarifa lo cobra el
 * estacionamiento en el lugar, directo del cliente; SpotNear no lo intermedia y
 * por lo tanto no le transfiere nada al dueño después.
 *
 * Por eso `montoDeCobro()` devuelve `montoComision` y no `precioTotal`: cobrar
 * el total sería quedarse con plata que no es de la plataforma.
 *
 * El contrato es el mismo para todos los proveedores:
 *   crearPreferencia(reserva, monto) -> { requierePago, urlPago?, ref?, estado }
 *   consultarEstado(reserva)         -> { estado, detalle?, pagoId? }
 *   listo()                          -> ¿tiene lo que necesita para cobrar?
 *
 * Tres modos, por PAYMENT_PROVIDER:
 *
 *  · simulado    → cobra de mentira y deja la seña PAGADA al instante. Es el
 *                  default: permite probar el flujo completo sin credenciales.
 *  · mercadopago → cobro real con Checkout Pro. Ver ./mercadopago.js.
 *  · none        → sin pasarela; la seña queda PENDIENTE de cobro.
 *
 * La diferencia importante entre los tres no es cómo cobran, sino CUÁNDO queda
 * confirmada la reserva. Con `mercadopago` la reserva nace PENDIENTE y no
 * existe comprobante hasta que Mercado Pago dice `approved`; con los otros dos
 * la reserva queda confirmada en el acto. Eso lo decide `requierePagoPrevio()`.
 */
import env from '../../config/env.js';
import proveedorMercadoPago from './mercadopago.js';

/**
 * Proveedor simulado.
 *
 * No toca ninguna pasarela: da el pago por aprobado en el acto. Sirve para
 * desarrollo y para demos. Avisa por consola en cada cobro, para que nadie se
 * confunda y crea que está entrando plata de verdad.
 */
const proveedorSimulado = {
  nombre: 'simulado',
  listo: () => true,
  requierePagoPrevio: false,
  async crearPreferencia(reserva, monto) {
    console.warn(
      `[pagos] COBRO SIMULADO de la seña: ${monto} ` +
        `(reserva ${reserva?.codigo ?? 's/código'}, tarifa del estacionamiento ` +
        `${reserva?.montoNeto ?? '?'} que se paga en el lugar). No se cobró nada de ` +
        'verdad: configurá PAYMENT_PROVIDER=mercadopago y las credenciales para cobrar en serio.',
    );
    return {
      requierePago: false,
      estado: 'PAGADO',
      urlPago: null,
      ref: `sim_${Date.now().toString(36)}`,
    };
  },
  async consultarEstado() {
    return { estado: 'PAGADO', detalle: 'simulado', pagoId: null };
  },
};

/**
 * Sin pasarela configurada.
 *
 * El cobro sigue siendo por adelantado en la plataforma: lo que falta es el
 * proveedor que lo ejecute, no el modelo. Por eso la reserva queda PENDIENTE de
 * cobro y no "paga al llegar", que es lo que decía antes y ya no corresponde.
 */
const proveedorNinguno = {
  nombre: 'none',
  listo: () => true,
  requierePagoPrevio: false,
  async crearPreferencia() {
    return { requierePago: true, estado: 'PENDIENTE', urlPago: null, ref: null };
  },
  async consultarEstado() {
    return { estado: 'PENDIENTE', detalle: null, pagoId: null };
  },
};

/**
 * Cuánto se le cobra al cliente por la pasarela.
 *
 * Solo la seña. `montoComision` es el nombre de la columna en la base (viene
 * del modelo anterior); de cara al cliente esto es la seña para reservar.
 *
 * @param {object} reserva
 * @returns {number}
 */
export function montoDeCobro(reserva) {
  return Number(reserva?.montoComision ?? 0);
}

function proveedorActivo() {
  if (env.PAYMENT_PROVIDER === 'mercadopago') {
    return { ...proveedorMercadoPago, requierePagoPrevio: true };
  }
  if (env.PAYMENT_PROVIDER === 'none') return proveedorNinguno;
  return proveedorSimulado;
}

/** Nombre del proveedor activo, para guardarlo en la reserva. */
export function proveedorDePago() {
  return proveedorActivo().nombre;
}

/** ¿El cobro es de mentira? Lo consulta el frontend para avisarlo en pantalla. */
export function pagoSimulado() {
  return proveedorActivo().nombre === 'simulado';
}

/** ¿Está habilitado el cobro online? Lo consulta el frontend para mostrar u ocultar el paso. */
export function pagoOnlineHabilitado() {
  return env.PAYMENT_PROVIDER !== 'none';
}

/**
 * ¿Hay que tener la seña acreditada ANTES de confirmar la reserva?
 *
 * Con Mercado Pago sí: sin seña no hay reserva, así que la reserva nace
 * PENDIENTE, no se emite comprobante y no se avisa al estacionamiento hasta
 * que el pago esté aprobado.
 */
export function requierePagoPrevio() {
  return Boolean(proveedorActivo().requierePagoPrevio);
}

/**
 * ¿La pasarela tiene lo que necesita para cobrar?
 *
 * Se consulta ANTES de crear la reserva: si falta el access token, es preferible
 * decirlo en el checkout que dejar reservas colgadas esperando una seña que
 * nunca se va a poder cobrar.
 */
export function pasarelaLista() {
  return proveedorActivo().listo();
}

/**
 * @param {object} reserva
 * @returns {Promise<{ requierePago: boolean, estado: string, urlPago: string|null, ref: string|null }>}
 */
export async function crearPreferenciaDePago(reserva) {
  const monto = montoDeCobro(reserva);

  // Sin monto no hay nada que cobrar (comisión en 0). Mercado Pago rechaza un
  // ítem de precio 0, así que ni se lo pide: la reserva queda saldada.
  if (monto <= 0) {
    return { requierePago: false, estado: 'PAGADO', urlPago: null, ref: null };
  }

  return proveedorActivo().crearPreferencia(reserva, monto);
}

/**
 * Estado del cobro de una reserva, preguntado a la pasarela.
 * @param {object} reserva
 */
export async function consultarEstadoDePago(reserva) {
  if (montoDeCobro(reserva) <= 0) return { estado: 'PAGADO', detalle: null, pagoId: null };
  return proveedorActivo().consultarEstado(reserva);
}

export { montoDeCobro as montoASenar };

export default {
  montoDeCobro,
  crearPreferenciaDePago,
  consultarEstadoDePago,
  pagoOnlineHabilitado,
  pagoSimulado,
  proveedorDePago,
  requierePagoPrevio,
  pasarelaLista,
};
