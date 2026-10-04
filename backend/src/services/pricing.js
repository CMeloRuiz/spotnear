/**
 * Cálculo de precios y comisión.
 *
 * ESCALONES DE ESTADÍA (la forma en que se cobra en Argentina)
 *
 * El precio no es lineal por hora. A partir de las 4 horas se cobra un fijo,
 * que es lo que hace cualquier playa: al que deja el auto medio día no se le
 * cobra hora por hora.
 *
 *   · Menos de 4 h    → por hora, redondeando hacia arriba, mínimo 1 hora.
 *   · MEDIA ESTADÍA   → [4, 12) horas  → tarifa horaria × 4, fijo.
 *   · ESTADÍA COMPLETA→ [12, 24) horas → tarifa horaria × 5, fijo.
 *                       (la media estadía más una hora)
 *   · Más de 24 h     → el ciclo se reinicia: se cobra una estadía completa por
 *                       cada bloque entero de 24 h y el escalón que corresponda
 *                       sobre las horas sobrantes.
 *
 * Las 12 horas exactas caen en ESTADÍA COMPLETA, no en media estadía: el
 * intervalo de media estadía es [4, 12) y el de completa [12, 24). Las 24 horas
 * exactas no entran en el intervalo: ahí el ciclo se reinicia y se cobran como
 * un ciclo entero, que da el mismo importe (una estadía completa).
 *
 * Ejemplo con hora a $6.500:
 *   3 h  → $19.500 (3 × 6.500)
 *   6 h  → $26.000 (media estadía)
 *   11 h → $26.000 (misma media estadía)
 *   12 h → $32.500 (estadía completa)
 *   24 h → $32.500 (una estadía completa)
 *   29 h → $58.500 (una completa + media estadía por las 5 horas restantes)
 *
 * La tarifa horaria de la que sale todo esto es la que corresponde al TIPO DE
 * VEHÍCULO de la reserva: una camioneta y una moto arrancan de valores
 * distintos, y por lo tanto su media estadía también difiere.
 *
 * TARIFA POR DÍA
 * Si el estacionamiento cargó una tarifa diaria y sale más barata que el
 * escalón, se cobra esa. Nunca le conviene menos al cliente dejar el auto más
 * tiempo.
 *
 * MENSUAL
 * Precio fijo por mes iniciado (flujo simplificado en la v1).
 *
 * El precio se congela en la reserva: si mañana el estacionamiento sube la
 * tarifa, la reserva ya hecha mantiene el precio pactado.
 *
 * SOBRE LA COMISIÓN: se calcula sobre el subtotal (lo que cobra el
 * estacionamiento) y se SUMA. El cliente paga subtotal + servicio; el
 * estacionamiento cobra el subtotal completo. Ver calcularCobro() en money.js.
 */
import { aNumero, redondear, calcularCobro } from '../utils/money.js';
import { horasEntre } from '../utils/dates.js';
import { AppError } from '../utils/errors.js';

const HORAS_POR_DIA = 24;
const DIAS_POR_MES = 30;

/** Límites de los escalones, en horas. */
export const HORAS_MEDIA_ESTADIA = 4;
export const HORAS_ESTADIA_COMPLETA = 12;

/** Multiplicadores sobre la tarifa horaria. */
export const MULTIPLICADOR_MEDIA = 4;
export const MULTIPLICADOR_COMPLETA = 5;

/**
 * ¿En qué escalón cae una duración? Se usa también en la pantalla de
 * resultados para rotular el precio ("Mostrar precio de la media estadía").
 *
 * @param {number} horas Duración en horas decimales.
 * @returns {'HORA'|'MEDIA_ESTADIA'|'ESTADIA_COMPLETA'}
 */
export function escalonDeEstadia(horas) {
  // Se mira el resto del ciclo de 24 h: a partir de ahí todo se repite igual.
  const resto = horas % HORAS_POR_DIA;
  // 24 h exactas (resto 0) son una estadía completa, no cero.
  const efectivas = resto === 0 && horas > 0 ? HORAS_POR_DIA : resto;

  if (efectivas < HORAS_MEDIA_ESTADIA) return 'HORA';
  if (efectivas < HORAS_ESTADIA_COMPLETA) return 'MEDIA_ESTADIA';
  return 'ESTADIA_COMPLETA';
}

/**
 * ¿Esta tarifa aplica al vehículo y al momento pedidos?
 * @param {object} tarifa
 * @param {{ vehicleType?: string, inicio: Date, fin: Date }} ctx
 */
function tarifaAplica(tarifa, { vehicleType, inicio, fin }) {
  if (!tarifa.activo) return false;
  // Con un tipo de vehículo pedido, una tarifa atada a OTRO tipo no aplica.
  //
  // Sin tipo pedido (la búsqueda inicial, que no pregunta el vehículo) sí
  // aplican todas: quién gana lo decide elegirEntre(), que prefiere la general
  // y recién después las específicas. Excluirlas acá dejaba sin cotizar —y por
  // lo tanto INVISIBLE en la búsqueda— a todo estacionamiento que solo tuviera
  // tarifas por tipo de vehículo.
  if (vehicleType && tarifa.vehicleType && tarifa.vehicleType !== vehicleType) return false;
  if (tarifa.vigenciaDesde && new Date(tarifa.vigenciaDesde) > new Date(fin)) return false;
  if (tarifa.vigenciaHasta && new Date(tarifa.vigenciaHasta) < new Date(inicio)) return false;
  return true;
}

/** Vehículo que se asume cuando el cliente todavía no eligió ninguno. */
const VEHICULO_POR_DEFECTO = 'AUTO';

const masBarata = (tarifas) =>
  tarifas.reduce((min, t) => (aNumero(t.precio) < aNumero(min.precio) ? t : min));

/**
 * Elige una tarifa entre varias que ya aplican, según si el cliente eligió
 * vehículo o no.
 *
 * CON vehículo elegido: gana la específica de ese tipo; si no hay, la general.
 *
 * SIN vehículo elegido (búsqueda inicial): gana la general, porque mostrarle el
 * precio de moto a quien está buscando para un auto es prometerle algo que
 * después no se cumple. Si el estacionamiento no tiene ninguna general, se cae
 * a la de AUTO, que es el caso más frecuente, y recién en último lugar a la más
 * barata de las que queden. Lo importante es que SIEMPRE devuelva algo si hay
 * alguna tarifa: sin precio, la búsqueda descarta el estacionamiento en
 * silencio y el dueño no se entera de por qué no aparece.
 */
function elegirEntre(candidatas, vehicleType) {
  if (candidatas.length === 0) return null;

  const generales = candidatas.filter((t) => !t.vehicleType);

  if (vehicleType) {
    const especificas = candidatas.filter((t) => t.vehicleType === vehicleType);
    if (especificas.length > 0) return masBarata(especificas);
    return generales.length > 0 ? masBarata(generales) : null;
  }

  if (generales.length > 0) return masBarata(generales);

  const porDefecto = candidatas.filter((t) => t.vehicleType === VEHICULO_POR_DEFECTO);
  if (porDefecto.length > 0) return masBarata(porDefecto);

  return masBarata(candidatas);
}

/** Elige la tarifa de un tipo (HORA, DIA, MENSUAL) entre las que aplican. */
function mejorTarifa(tarifas, tipo, ctx) {
  const candidatas = tarifas.filter((t) => t.tipo === tipo && tarifaAplica(t, ctx));
  return elegirEntre(candidatas, ctx.vehicleType);
}

/**
 * Precio de un bloque de hasta 24 horas, aplicando el escalón que corresponda.
 *
 * @param {number} horas  Horas del bloque (1 a 24).
 * @param {number} valorHora
 * @returns {{ total: number, escalon: string, etiqueta: string }}
 */
function cobrarBloque(horas, valorHora) {
  const escalon = escalonDeEstadia(horas);

  if (escalon === 'ESTADIA_COMPLETA') {
    return {
      total: redondear(valorHora * MULTIPLICADOR_COMPLETA),
      escalon,
      etiqueta: 'Estadía completa',
    };
  }
  if (escalon === 'MEDIA_ESTADIA') {
    return {
      total: redondear(valorHora * MULTIPLICADOR_MEDIA),
      escalon,
      etiqueta: 'Media estadía',
    };
  }

  const enteras = Math.max(1, Math.ceil(horas));
  return {
    total: redondear(valorHora * enteras),
    escalon,
    etiqueta: enteras === 1 ? '1 hora' : `${enteras} horas`,
  };
}

/**
 * Precio total por escalones, partiendo la estadía en bloques de 24 horas.
 *
 * @param {number} horasReales
 * @param {number} valorHora
 */
export function precioPorEscalones(horasReales, valorHora) {
  const ciclosCompletos = Math.floor(horasReales / HORAS_POR_DIA);
  const resto = horasReales - ciclosCompletos * HORAS_POR_DIA;

  // Cada ciclo entero de 24 h se cobra como una estadía completa.
  const totalCiclos = redondear(ciclosCompletos * valorHora * MULTIPLICADOR_COMPLETA);

  // Un resto de 0 significa que la estadía terminó justo en el corte: no hay
  // bloque adicional que cobrar.
  if (resto <= 0) {
    return {
      total: totalCiclos,
      escalon: 'ESTADIA_COMPLETA',
      etiqueta:
        ciclosCompletos === 1 ? 'Estadía completa' : `${ciclosCompletos} estadías completas`,
      ciclos: ciclosCompletos,
    };
  }

  const bloqueFinal = cobrarBloque(resto, valorHora);

  if (ciclosCompletos === 0) {
    return { ...bloqueFinal, total: bloqueFinal.total, ciclos: 0 };
  }

  const dias = ciclosCompletos === 1 ? '1 día' : `${ciclosCompletos} días`;
  return {
    total: redondear(totalCiclos + bloqueFinal.total),
    escalon: bloqueFinal.escalon,
    etiqueta: `${dias} + ${bloqueFinal.etiqueta.toLowerCase()}`,
    ciclos: ciclosCompletos,
  };
}

/**
 * Calcula el precio de una estadía.
 *
 * @param {object} params
 * @param {object} params.parking            Con comisionPorcentaje
 * @param {Array}  params.tarifas            Tarifas del estacionamiento
 * @param {Date|string} params.inicio
 * @param {Date|string} params.fin
 * @param {string} [params.vehicleType]
 * @param {number} [params.cantidadVehiculos=1]
 * @param {'HORARIO'|'MENSUAL'} [params.modalidad='HORARIO']
 * @returns {{
 *   subtotal: number, precioTotal: number, comisionPorcentaje: number,
 *   montoComision: number, montoNeto: number, moneda: string, desglose: object
 * }}
 */
export function calcularPrecio({
  parking,
  tarifas = [],
  inicio,
  fin,
  vehicleType = null,
  cantidadVehiculos = 1,
  modalidad = 'HORARIO',
}) {
  const desde = new Date(inicio);
  const hasta = new Date(fin);

  if (!(desde instanceof Date) || Number.isNaN(desde.getTime())) {
    throw new AppError('La fecha de inicio no es válida.', 422, 'FECHA_INVALIDA');
  }
  if (Number.isNaN(hasta.getTime()) || hasta <= desde) {
    throw new AppError(
      'La hora de salida tiene que ser posterior a la de ingreso.',
      422,
      'RANGO_INVALIDO',
    );
  }

  const ctx = { vehicleType, inicio: desde, fin: hasta };
  const horasReales = horasEntre(desde, hasta);
  const cantidad = Math.max(1, Number(cantidadVehiculos) || 1);

  let modo;
  let precioUnitario;
  let unidades;
  let etiqueta;
  let tarifaUsada = null;
  let subtotalUnitario;
  let escalon = null;

  if (modalidad === 'MENSUAL') {
    const mensual = mejorTarifa(tarifas, 'MENSUAL', ctx);
    if (!mensual) {
      throw new AppError(
        'Este estacionamiento no tiene tarifa mensual cargada.',
        422,
        'SIN_TARIFA_MENSUAL',
      );
    }
    modo = 'MENSUAL';
    tarifaUsada = mensual;
    precioUnitario = aNumero(mensual.precio);
    unidades = Math.max(1, Math.ceil(horasReales / (HORAS_POR_DIA * DIAS_POR_MES)));
    etiqueta = unidades === 1 ? '1 mes' : `${unidades} meses`;
    subtotalUnitario = redondear(precioUnitario * unidades);
  } else {
    const porHora = mejorTarifa(tarifas, 'HORA', ctx);
    const porDia = mejorTarifa(tarifas, 'DIA', ctx);

    if (!porHora && !porDia) {
      throw new AppError(
        'Este estacionamiento todavía no tiene tarifas cargadas.',
        422,
        'SIN_TARIFA',
      );
    }

    const opciones = [];

    if (porHora) {
      const porEscalones = precioPorEscalones(horasReales, aNumero(porHora.precio));
      opciones.push({
        modo: porEscalones.escalon === 'HORA' ? 'HORA' : porEscalones.escalon,
        tarifa: porHora,
        precioUnitario: aNumero(porHora.precio),
        unidades: Math.max(1, Math.ceil(horasReales)),
        total: porEscalones.total,
        etiqueta: porEscalones.etiqueta,
        escalon: porEscalones.escalon,
      });
    }

    if (porDia) {
      const dias = Math.max(1, Math.ceil(horasReales / HORAS_POR_DIA));
      opciones.push({
        modo: 'DIA',
        tarifa: porDia,
        precioUnitario: aNumero(porDia.precio),
        unidades: dias,
        total: redondear(aNumero(porDia.precio) * dias),
        etiqueta: dias === 1 ? '1 día' : `${dias} días`,
        escalon: null,
      });
    }

    // Le cobramos al cliente la opción más conveniente.
    const ganadora = opciones.reduce((min, o) => (o.total < min.total ? o : min));
    modo = ganadora.modo;
    tarifaUsada = ganadora.tarifa;
    precioUnitario = ganadora.precioUnitario;
    unidades = ganadora.unidades;
    etiqueta = ganadora.etiqueta;
    escalon = ganadora.escalon;
    subtotalUnitario = ganadora.total;
  }

  const subtotal = redondear(subtotalUnitario * cantidad);

  const porcentaje =
    parking?.comisionPorcentaje !== undefined && parking?.comisionPorcentaje !== null
      ? aNumero(parking.comisionPorcentaje)
      : 20;

  const cobro = calcularCobro(subtotal, porcentaje);

  return {
    ...cobro,
    moneda: parking?.moneda ?? 'ARS',
    desglose: {
      modo,
      escalon,
      etiqueta,
      precioUnitario,
      unidades,
      cantidadVehiculos: cantidad,
      subtotal,
      // Los tres montos que necesita la interfaz, ya nombrados, para que nadie
      // los recalcule por su cuenta y se desincronicen de los escalones.
      sena: cobro.montoComision,
      aPagarAhora: cobro.montoComision,
      aPagarEnElLugar: cobro.montoNeto,
      horasReales: redondear(horasReales, 2),
      tarifaId: tarifaUsada?.id ?? null,
    },
  };
}

/**
 * Precio "desde" que se muestra en las tarjetas de resultados.
 *
 * Mismo criterio que la cotización: general primero, después AUTO, después lo
 * que haya. Así el "desde $X" coincide con el precio que se muestra y no
 * desaparece cuando el estacionamiento solo tiene tarifas por vehículo.
 */
export function tarifaDesde(tarifas = []) {
  const horarias = tarifas.filter((t) => t.activo && t.tipo === 'HORA');
  const elegida = elegirEntre(horarias, null);
  return elegida ? { precio: aNumero(elegida.precio), tipo: 'HORA' } : null;
}

export default { calcularPrecio, tarifaDesde, escalonDeEstadia, precioPorEscalones };
