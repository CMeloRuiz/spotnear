/**
 * Helpers de dinero. Todo en pesos argentinos (ARS).
 *
 * Prisma devuelve Decimal; para operar usamos números con 2 decimales
 * y redondeo "half up", que es el que espera un contador.
 */

/** @param {unknown} valor */
export function aNumero(valor) {
  if (valor === null || valor === undefined) return 0;
  // Prisma.Decimal expone toNumber(); los Decimal también responden a toString()
  if (typeof valor === 'object' && typeof valor.toNumber === 'function') return valor.toNumber();
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Redondeo a 2 decimales, half-up, evitando el clásico 1.005 → 1.00 del binario.
 * @param {number} n
 */
export function redondear(n, decimales = 2) {
  const factor = 10 ** decimales;
  return Math.round((aNumero(n) + Number.EPSILON) * factor) / factor;
}

/**
 * Calcula comisión de SpotNear y neto del estacionamiento.
 * @param {number} precioTotal
 * @param {number} porcentaje  Ej: 20 para 20%.
 * @returns {{ precioTotal: number, comisionPorcentaje: number, montoComision: number, montoNeto: number }}
 */
/**
 * Desglose de cobro del modelo de SEÑA NO REEMBOLSABLE.
 *
 * El cliente paga online solo la seña (el 20% de la tarifa) para reservar el
 * lugar. El resto lo paga en el estacionamiento, en efectivo o como maneje
 * cada lugar, igual que antes de que existiera SpotNear.
 *
 *     Estacionamiento  $12.000   ← lo paga ALLÁ, íntegro, al dueño
 *     Seña              $2.400   ← 20% sobre esa tarifa, se paga ACÁ y no se devuelve
 *     Total            $14.400   ← lo que le sale la reserva al cliente
 *
 * La seña se SUMA, no se descuenta: el estacionamiento recibe el 100% de su
 * tarifa. Por eso `montoNeto === subtotal`, y no hay nada que liquidarle
 * después: ya cobró en el lugar.
 *
 * Nomenclatura: de cara al cliente esto es una "seña". Los nombres
 * `montoComision` y `comisionPorcentaje` se conservan porque son los de las
 * columnas de la base y los que usan las pantallas internas del panel, donde
 * sí corresponde hablar de lo que retiene SpotNear.
 *
 * Se mantiene la invariante de siempre: seña + neto === total, al peso.
 *
 * @param {number} subtotal    Lo que cobra el estacionamiento (lo recibe entero).
 * @param {number} porcentaje  Porcentaje de la seña.
 */
export function calcularCobro(subtotal, porcentaje) {
  const base = redondear(subtotal);
  const pct = redondear(porcentaje);
  const montoComision = redondear((base * pct) / 100);

  return {
    subtotal: base,
    comisionPorcentaje: pct,
    montoComision,
    // El neto es el subtotal entero: el estacionamiento no resigna nada.
    montoNeto: base,
    precioTotal: redondear(base + montoComision),
  };
}

/**
 * Comisión DESCONTADA de un total ya cerrado.
 *
 * Se conserva para las reservas viejas, donde el precio pactado incluía la
 * comisión, y para los reportes que recalculan sobre datos históricos.
 */
export function calcularComision(precioTotal, porcentaje) {
  const total = redondear(precioTotal);
  const pct = redondear(porcentaje);
  const montoComision = redondear((total * pct) / 100);
  // El neto se obtiene por resta para que comisión + neto === total exacto siempre.
  const montoNeto = redondear(total - montoComision);
  return { precioTotal: total, comisionPorcentaje: pct, montoComision, montoNeto };
}

/**
 * Formato argentino: $12.000 (sin decimales si son redondos).
 * @param {number|object} valor
 */
export function formatearARS(valor) {
  const n = aNumero(valor);
  const tieneCentavos = Math.abs(n % 1) > 0.001;
  const formateado = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: tieneCentavos ? 2 : 0,
    maximumFractionDigits: tieneCentavos ? 2 : 0,
  }).format(n);
  // Intl en es-AR devuelve "$ 12.000" (con espacio duro). Acá se escribe pegado.
  return formateado.replace(/^(\$)\s*/u, '$1').replace(/\u00a0/g, ' ');
}
