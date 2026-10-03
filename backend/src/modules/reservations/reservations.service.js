/**
 * Reservas: creación, consulta y cambios de estado.
 *
 * La creación corre dentro de una transacción SERIALIZABLE porque el recurso
 * que se reparte es finito (los lugares). Sin eso, dos personas que reservan
 * el último lugar en el mismo segundo entrarían las dos.
 */
import prisma from '../../config/prisma.js';
import errores, { AppError } from '../../utils/errors.js';
import { generarCodigoReserva, generarTokenPublico, normalizarCodigo } from '../../utils/codes.js';
import { calcularPrecio } from '../../services/pricing.js';
import { verificarCupo } from '../../services/availability.js';
import {
  crearPreferenciaDePago,
  consultarEstadoDePago,
  montoDeCobro,
  pagoOnlineHabilitado,
  pasarelaLista,
  proveedorDePago,
  requierePagoPrevio,
} from '../../services/payments/index.js';
import { notificarReservaCreada } from '../../services/notifications/index.js';
import { emailDelVendedor } from '../../services/payments/mercadopago.js';
import { normalizarPatente } from '../../utils/patente.js';
import { aNumero } from '../../utils/money.js';
import { validarHorario } from '../../utils/horarios.js';

/** Include estándar para devolver una reserva completa. */
export const INCLUDE_COMPLETO = {
  parking: {
    select: {
      id: true,
      slug: true,
      nombre: true,
      direccion: true,
      barrio: true,
      ciudad: true,
      lat: true,
      lng: true,
      telefono: true,
      whatsappGrupo: true,
      tipoHorario: true,
      horarios: true,
      // Para saber si hay que mostrarlo como eliminado (ver parkingParaMostrar).
      eliminadoEn: true,
    },
  },
  customer: true,
  vehicle: true,
};

/** Transiciones de estado permitidas. Fuera de esto, se rechaza. */
/**
 * Una reserva en PENDIENTE es una reserva cuya seña todavía no se acreditó: el
 * lugar está apartado mientras el cliente paga, pero no es una reserva. Desde
 * el panel lo único que se le puede hacer es cancelarla. Confirmarla o hacerle
 * check-in sería dejar entrar a alguien que no pagó la seña; eso lo hace solo
 * la acreditación del pago (confirmarSena), nunca una persona.
 */
export const SIN_SENA = 'PENDIENTE';

/**
 * Filtro de Prisma para dejar afuera las reservas que esperan la seña. Lo usan
 * todas las vistas operativas del panel (listado, dashboard, resumen del día,
 * búsqueda rápida): para el estacionamiento, eso todavía no es un cliente que
 * va a llegar.
 */
export const SOLO_CON_SENA = { estado: { not: SIN_SENA } };

/**
 * Estados en los que una reserva se puede quitar del panel: los que ya no
 * representan actividad futura. Una pendiente, confirmada o en curso todavía
 * puede ocurrir, así que primero se cancela.
 */
export const ESTADOS_ELIMINABLES = ['FINALIZADA', 'CANCELADA', 'NO_SHOW'];

const TRANSICIONES = {
  PENDIENTE: ['CANCELADA'],
  CONFIRMADA: ['EN_CURSO', 'CANCELADA', 'NO_SHOW'],
  EN_CURSO: ['FINALIZADA', 'CANCELADA'],
  FINALIZADA: [],
  CANCELADA: [],
  NO_SHOW: [],
};

// Se reexporta desde su nuevo hogar para no romper los imports existentes.
export { validarHorario };

/**
 * ¿Esta reserva todavía está esperando que se acredite la seña?
 *
 * Es la pregunta que define TODO lo que viene después: mientras la respuesta
 * sea que sí, no hay comprobante, no hay QR y no sale el aviso al grupo del
 * estacionamiento. Sin seña no hay reserva.
 *
 * Las reservas cargadas desde el panel nacen CONFIRMADA (el playero las toma en
 * el mostrador y la plata se arregla ahí), así que nunca caen acá.
 */
export function esperandoLaSena(reserva) {
  return reserva?.estado === 'PENDIENTE' && reserva?.paymentStatus !== 'PAGADO';
}

/**
 * El email del comprador, cuando la seña se cobra con Mercado Pago.
 *
 * Es la causa del bug del botón "Pagar" que no respondía. Sin email en la
 * preferencia, Mercado Pago lo pide en su pantalla de revisión y, si queda
 * vacío, su botón "Pagar" no hace nada: ni un mensaje ni una petición de pago.
 * Con el email de la propia cuenta vendedora pasa lo mismo, porque Mercado Pago
 * no deja pagarse a uno mismo. Las dos cosas se validan acá, en nuestro
 * formulario, con un mensaje que se entiende.
 */
async function validarEmailParaMercadoPago(email) {
  const campo = (mensaje) =>
    errores.datosInvalidos({ campos: [{ campo: 'cliente.email', mensaje }] }, mensaje);

  if (!email) {
    throw campo('Necesitamos tu email para el pago de la seña: Mercado Pago lo pide para procesarlo y ahí te manda el recibo.');
  }

  const vendedor = await emailDelVendedor();
  if (vendedor && String(email).toLowerCase() === vendedor) {
    throw campo(
      'Ese email es el de la cuenta de Mercado Pago que cobra las señas, y Mercado Pago no deja pagarse a uno mismo. Usá otro email.',
    );
  }
}

/**
 * Arranca el cobro de la reserva recién creada y deja el resultado asentado.
 *
 * Nunca lanza: la reserva ya está hecha y el lugar apartado. Si la pasarela
 * falla al crear la preferencia, la reserva queda con el cobro en FALLIDO y el
 * cliente puede reintentar desde la pantalla de pago.
 */
async function cobrar(reserva) {
  if (!pagoOnlineHabilitado()) return reserva;

  // Con cobro previo (Mercado Pago) la preferencia NO se crea acá: la reserva
  // queda apartada y el cliente pasa a la pantalla de pago, donde lee que le
  // falta pagar la seña. Recién cuando aprieta "Pagar la seña" se arma el
  // checkout (iniciarCobroDeSena). Así nada lo manda a la pasarela sin que él
  // lo haya pedido, y la preferencia —que vence— nace en el momento de usarla.
  if (requierePagoPrevio() && montoDeCobro(reserva) > 0) return reserva;

  try {
    const resultado = await crearPreferenciaDePago(reserva);

    // requierePago = el cliente todavía tiene que ir a pagar a la pasarela
    // (Checkout Pro). La reserva se queda PENDIENTE, esperando el webhook o la
    // consulta directa. Ahí se confirma, no antes.
    if (resultado.requierePago) {
      return prisma.reservation.update({
        where: { id: reserva.id },
        data: {
          paymentRef: resultado.ref ?? null,
          paymentUrl: resultado.urlPago ?? null,
          paymentStatus: 'PENDIENTE',
        },
        include: INCLUDE_COMPLETO,
      });
    }

    const pagada = resultado.estado === 'PAGADO';

    return prisma.reservation.update({
      where: { id: reserva.id },
      data: {
        paymentStatus: pagada ? 'PAGADO' : 'PENDIENTE',
        paymentRef: resultado.ref ?? null,
        pagadaEn: pagada ? new Date() : null,
        // Si nació PENDIENTE esperando la seña y la seña ya está, se confirma.
        ...(pagada && reserva.estado === 'PENDIENTE' ? { estado: 'CONFIRMADA' } : {}),
      },
      include: INCLUDE_COMPLETO,
    });
  } catch (error) {
    console.error('[pagos] no se pudo cobrar la reserva', reserva.codigo, error.message);
    return prisma.reservation
      .update({
        where: { id: reserva.id },
        data: { paymentStatus: 'FALLIDO', paymentDetalle: error.message?.slice(0, 200) ?? null },
        include: INCLUDE_COMPLETO,
      })
      .catch(() => reserva);
  }
}

/** Genera un código único; reintenta ante la colisión (altamente improbable). */
async function codigoUnico(tx, intentos = 5) {
  for (let i = 0; i < intentos; i++) {
    const codigo = generarCodigoReserva();
    const existe = await tx.reservation.findUnique({ where: { codigo }, select: { id: true } });
    if (!existe) return codigo;
  }
  throw errores.interno('No se pudo generar un código de reserva. Intentá de nuevo.');
}

/**
 * Reutiliza el cliente si ya reservó antes (mismo teléfono); si no, lo crea.
 *
 * NO le pisa el nombre. Antes sí lo hacía, "por si el cliente corrigió su
 * apellido", y eso provocó el peor bug que tuvo el sistema: un teléfono lo
 * comparten una familia, una oficina o un playero que reserva para terceros,
 * así que la reserva nueva renombraba al Customer compartido y, con él, a
 * TODAS las reservas anteriores de ese teléfono. Nueve reservas quedaron mal
 * etiquetadas antes de que se detectara.
 *
 * Lo único que se completa es lo que estaba vacío: sumar un email que antes no
 * había es información nueva; reemplazar un nombre existente es destruirla.
 * El nombre de cada reserva se congela en la reserva misma (ver crearReserva).
 */
async function obtenerOCrearCliente(tx, cliente) {
  const existente = await tx.customer.findFirst({
    where: { telefono: cliente.telefono },
    orderBy: { createdAt: 'desc' },
  });

  if (existente) {
    // Solo se rellenan huecos. Nada de lo que ya tiene valor se toca.
    const aCompletar = {};
    if (!existente.email && cliente.email) aCompletar.email = cliente.email;

    if (Object.keys(aCompletar).length === 0) return existente;

    return tx.customer.update({ where: { id: existente.id }, data: aCompletar });
  }

  return tx.customer.create({ data: cliente });
}

/** Reutiliza el vehículo por patente; si no existe, lo crea. */
async function obtenerOCrearVehiculo(tx, vehiculo) {
  const patente = normalizarPatente(vehiculo.patente);
  const existente = await tx.vehicle.findFirst({
    where: { patente },
    orderBy: { createdAt: 'desc' },
  });

  if (existente) {
    return tx.vehicle.update({
      where: { id: existente.id },
      data: {
        tipo: vehiculo.tipo ?? existente.tipo,
        marca: vehiculo.marca ?? existente.marca,
        modelo: vehiculo.modelo ?? existente.modelo,
        color: vehiculo.color ?? existente.color,
      },
    });
  }

  return tx.vehicle.create({ data: { ...vehiculo, patente } });
}

/**
 * Valida los campos extra configurados por el estacionamiento.
 * @returns {object} solo los campos declarados (se descarta lo que venga de más)
 */
function validarCamposExtra(configs, valores = {}) {
  const limpio = {};
  const faltantes = [];

  for (const config of configs) {
    const valor = valores[config.key];
    const vacio = valor === undefined || valor === null || valor === '';

    if (config.requerido && vacio) {
      faltantes.push({ campo: config.key, mensaje: `${config.label} es obligatorio.` });
      continue;
    }
    if (vacio) continue;

    if (config.tipo === 'SELECT' && config.opciones.length > 0 && !config.opciones.includes(valor)) {
      faltantes.push({ campo: config.key, mensaje: `${config.label}: elegí una opción válida.` });
      continue;
    }
    if (config.tipo === 'NUMERO' && Number.isNaN(Number(valor))) {
      faltantes.push({ campo: config.key, mensaje: `${config.label} tiene que ser un número.` });
      continue;
    }

    limpio[config.key] =
      config.tipo === 'NUMERO'
        ? Number(valor)
        : config.tipo === 'BOOLEAN'
          ? Boolean(valor)
          : String(valor).slice(0, 500);
  }

  if (faltantes.length > 0) {
    throw errores.datosInvalidos({ campos: faltantes }, 'Faltan datos requeridos por el estacionamiento.');
  }

  return limpio;
}

/**
 * Crea una reserva.
 *
 * @param {object} datos
 * @param {string} datos.parkingId
 * @param {Date}   datos.inicio
 * @param {Date}   datos.fin
 * @param {{ nombre: string, apellido: string, telefono: string, email?: string }} datos.cliente
 * @param {{ patente: string, tipo: string, marca?: string, modelo?: string, color?: string }} datos.vehiculo
 * @param {number} [datos.cantidadVehiculos=1]
 * @param {string} [datos.notas]
 * @param {object} [datos.camposExtra]
 * @param {'WEB'|'ADMIN'|'WHATSAPP'|'TELEFONO'|'API'} [datos.source='WEB']
 * @param {string} [datos.createdByUserId]
 * @param {boolean}[datos.desdePanel=false] Permite reservar en estacionamientos no publicados
 */
export async function crearReserva(datos) {
  const {
    parkingId,
    inicio,
    fin,
    cliente,
    vehiculo,
    cantidadVehiculos = 1,
    idempotencyKey = null,
    notas = null,
    camposExtra = {},
    source = 'WEB',
    createdByUserId = null,
    desdePanel = false,
    modalidad = 'HORARIO',
  } = datos;

  if (fin <= inicio) {
    throw new AppError('La hora de salida tiene que ser posterior a la de ingreso.', 422, 'RANGO_INVALIDO');
  }

  // No se aceptan reservas para el pasado desde la web. Desde el panel sí:
  // el playero a veces carga algo que ya pasó para dejarlo registrado.
  if (!desdePanel && fin < new Date()) {
    throw new AppError('No podés reservar para un horario que ya pasó.', 422, 'FECHA_PASADA');
  }

  // Si la seña se cobra por adelantado, la pasarela tiene que estar en
  // condiciones ANTES de tocar la base: dejar reservas colgadas esperando un
  // cobro que nunca va a poder hacerse es peor que no dejar reservar.
  if (!desdePanel && !pasarelaLista()) {
    throw new AppError(
      'El pago en línea no está disponible en este momento. Probá de nuevo en un rato.',
      503,
      'PASARELA_NO_CONFIGURADA',
    );
  }

  // Con cobro previo la reserva nace PENDIENTE: el lugar queda apartado
  // mientras el cliente paga, pero no es una reserva hasta que la seña entre.
  const naceEsperandoLaSena = !desdePanel && requierePagoPrevio();

  if (naceEsperandoLaSena) await validarEmailParaMercadoPago(cliente.email);

  const crear = async (tx) => {
    const parking = await tx.parking.findUnique({
      where: { id: parkingId },
      include: {
        tarifas: {
          where: { activo: true },
        },
        camposExtra: { where: { activo: true } },
      },
    });

    if (!parking || !parking.activo) throw errores.noEncontrado('El estacionamiento');
    if (!desdePanel && !parking.publicado) {
      throw errores.noEncontrado('El estacionamiento');
    }

    // ¿Acepta este tipo de vehículo?
    if (vehiculo.tipo && !parking.tiposVehiculo.includes(vehiculo.tipo)) {
      throw new AppError(
        'Este estacionamiento no acepta ese tipo de vehículo.',
        422,
        'TIPO_VEHICULO_NO_ACEPTADO',
      );
    }

    // Horario de atención (solo para reservas públicas)
    if (!desdePanel) {
      const problema = validarHorario(parking, inicio);
      if (problema) throw new AppError(problema, 422, 'FUERA_DE_HORARIO');
    }

    const extras = validarCamposExtra(parking.camposExtra, camposExtra);

    // ── Control de capacidad ──
    await verificarCupo(parkingId, inicio, fin, {
      tx,
      capacidadTotal: parking.capacidadTotal,
      cantidad: cantidadVehiculos,
    });

    // ── Precio y comisión (se congelan acá) ──
    const precio = calcularPrecio({
      parking,
      tarifas: parking.tarifas,
      inicio,
      fin,
      vehicleType: vehiculo.tipo,
      cantidadVehiculos,
      modalidad,
    });

    const [customer, vehicle, codigo] = await Promise.all([
      obtenerOCrearCliente(tx, cliente),
      obtenerOCrearVehiculo(tx, vehiculo),
      codigoUnico(tx),
    ]);

    return tx.reservation.create({
      data: {
        codigo,
        publicToken: generarTokenPublico(),
        parkingId,
        customerId: customer.id,
        // Los datos del cliente se congelan acá, con los que vinieron en ESTE
        // pedido. La fila de Customer es un contacto que puede cambiar y que
        // varias personas comparten cuando comparten el teléfono; la reserva
        // es un documento de algo que ya pasó y no se re-escribe.
        clienteNombre: cliente.nombre,
        clienteApellido: cliente.apellido,
        clienteEmail: cliente.email ?? null,
        vehicleId: vehicle.id,
        inicio,
        fin,
        estado: naceEsperandoLaSena ? 'PENDIENTE' : 'CONFIRMADA',
        source,
        cantidadVehiculos,
        subtotal: precio.subtotal,
        precioTotal: precio.precioTotal,
        comisionPorcentaje: precio.comisionPorcentaje,
        montoComision: precio.montoComision,
        montoNeto: precio.montoNeto,
        moneda: precio.moneda,
        desglosePrecio: precio.desglose,
        // Nace PENDIENTE: el cobro se resuelve fuera de la transacción, apenas
        // la reserva existe. Sin pasarela configurada queda igual en PENDIENTE
        // (no hay "paga al llegar": el modelo es prepago).
        paymentStatus: 'PENDIENTE',
        paymentProvider: pagoOnlineHabilitado() ? proveedorDePago() : null,
        notas,
        camposExtra: extras,
        createdByUserId,
        idempotencyKey,
      },
      include: INCLUDE_COMPLETO,
    });
  };

  // Reintento del cliente: si ya existe una reserva con esta clave, es el
  // mismo pedido que llegó dos veces. Se devuelve la que ya está en vez de
  // crear otra. El índice único de la columna cubre la carrera entre dos
  // requests simultáneos; el catch de abajo la resuelve.
  if (idempotencyKey) {
    const yaCreada = await prisma.reservation.findUnique({
      where: { idempotencyKey },
      include: INCLUDE_COMPLETO,
    });
    if (yaCreada) return yaCreada;
  }

  // Serializable + reintentos: bajo concurrencia Postgres aborta una de las
  // transacciones en conflicto (P2034) y hay que volver a intentar.
  const MAX_INTENTOS = 3;
  let ultimoError;

  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    try {
      const reserva = await prisma.$transaction(crear, {
        isolationLevel: 'Serializable',
        timeout: 15_000,
      });

      // El cobro vive fuera de la transacción: es una llamada HTTP a la
      // pasarela y no queremos tenerla adentro del lock de capacidad.
      return cobrar(reserva);
    } catch (error) {
      // Los errores de negocio no se reintentan: el cupo no va a aparecer solo.
      if (error instanceof AppError) throw error;

      // Dos reintentos del mismo pedido entraron a la vez y el segundo chocó
      // con el índice único: gana el primero y se devuelve su reserva.
      if (error?.code === 'P2002' && error?.meta?.target?.includes?.('idempotencyKey')) {
        const existente = await prisma.reservation.findUnique({
          where: { idempotencyKey },
          include: INCLUDE_COMPLETO,
        });
        if (existente) return existente;
      }
      if (error?.code !== 'P2034' || intento === MAX_INTENTOS) throw error;
      ultimoError = error;
      await new Promise((r) => setTimeout(r, 40 * intento));
    }
  }

  throw ultimoError ?? errores.interno();
}

/* ═══════════════════ La seña: confirmar, rechazar, reintentar ═══════════════════
 *
 * Todo lo que sigue responde a la misma regla: la reserva se confirma cuando la
 * seña está acreditada, y no antes. El pago puede confirmarse por dos caminos
 * —el webhook de la pasarela o la consulta directa desde la pantalla de pago— y
 * los dos terminan en `confirmarSena`, que es idempotente: el comprobante y el
 * aviso al estacionamiento salen UNA sola vez, gane la carrera quien gane.
 */

/**
 * Da la seña por acreditada y confirma la reserva.
 *
 * La idempotencia no es un detalle: el webhook de Mercado Pago reintenta, y
 * además la pantalla de pago consulta en paralelo. Sin esto, el estacionamiento
 * recibiría el mismo aviso tres veces. Se resuelve con un `updateMany`
 * condicionado a que todavía no esté pagada: la base decide quién llegó
 * primero, y solo ese dispara las notificaciones.
 *
 * @param {string} reservaId
 * @param {{ pagoId?: string|null, detalle?: string|null }} datos
 * @returns {Promise<{ reserva: object|null, reciénConfirmada: boolean }>}
 */
export async function confirmarSena(reservaId, { pagoId = null, detalle = null } = {}) {
  const { count } = await prisma.reservation.updateMany({
    where: { id: reservaId, paymentStatus: { not: 'PAGADO' } },
    data: {
      paymentStatus: 'PAGADO',
      pagadaEn: new Date(),
      paymentDetalle: detalle,
      ...(pagoId ? { paymentRef: pagoId } : {}),
    },
  });

  // Una reserva que ya estaba confirmada a mano desde el panel no se toca.
  await prisma.reservation.updateMany({
    where: { id: reservaId, estado: 'PENDIENTE' },
    data: { estado: 'CONFIRMADA' },
  });

  const reserva = await prisma.reservation.findUnique({
    where: { id: reservaId },
    include: INCLUDE_COMPLETO,
  });

  return { reserva, reciénConfirmada: count === 1 };
}

/**
 * EL momento del flujo: la seña se acreditó, así que la reserva pasa a existir.
 *
 * Acá y en ningún otro lado salen las dos cosas que el cliente y el
 * estacionamiento esperan, y salen juntas:
 *
 *   1. el comprobante para el cliente (WhatsApp con la imagen + email), y
 *   2. el aviso automático al grupo de WhatsApp del estacionamiento.
 *
 * Es a propósito que sea una sola función: tener el "confirmar" en un lugar y
 * el "avisar" en otro es cómo se llega a una reserva confirmada de la que el
 * estacionamiento nunca se enteró.
 *
 * Los dos caminos que pueden traer la novedad —el webhook de la pasarela y la
 * consulta de la pantalla de pago— terminan acá, y `reciénConfirmada` garantiza
 * que el aviso salga UNA vez aunque lleguen los dos a la vez.
 *
 * Un fallo notificando no revierte nada: la plata entró y la reserva vale. El
 * intento queda registrado en NotificationLog igual.
 */
export async function acreditarSenaYAvisar(reservaId, { pagoId = null, detalle = null } = {}) {
  const { reserva, reciénConfirmada } = await confirmarSena(reservaId, { pagoId, detalle });

  if (!reserva) {
    console.warn('[pagos] llegó un pago de una reserva que no existe:', reservaId);
    return { reserva: null, reciénConfirmada: false };
  }

  if (reciénConfirmada) {
    console.info(
      `[pagos] seña acreditada de ${reserva.codigo}: se emite el comprobante y sale el aviso al estacionamiento.`,
    );
    await notificarReservaCreada(reserva).catch((error) => {
      console.error(
        '[pagos] la reserva quedó confirmada pero fallaron las notificaciones:',
        error.message,
      );
    });
  }

  return { reserva, reciénConfirmada };
}

/**
 * Asienta un cobro que no se acreditó.
 *
 * La reserva NO se cancela: queda PENDIENTE con el cobro en FALLIDO, que es
 * exactamente "pago rechazado, se puede reintentar". Cancelarla obligaría al
 * cliente a cargar todo de nuevo por una tarjeta que no pasó.
 *
 * El lugar tampoco queda tomado para siempre: una reserva sin seña deja de
 * ocupar lugar a los MINUTOS_PARA_APARTAR (ver availability.js).
 */
export async function registrarSenaNoAcreditada(reservaId, { estado = 'FALLIDO', detalle = null } = {}) {
  await prisma.reservation.updateMany({
    // Si la seña ya había entrado, un aviso viejo no la puede dar de baja.
    where: { id: reservaId, paymentStatus: { not: 'PAGADO' } },
    data: { paymentStatus: estado, paymentDetalle: detalle },
  });

  return prisma.reservation.findUnique({ where: { id: reservaId }, include: INCLUDE_COMPLETO });
}

/**
 * Le pregunta a la pasarela en qué quedó el cobro y aplica lo que diga.
 *
 * Es el camino que NO depende del webhook. Hace falta por dos motivos: en
 * desarrollo Mercado Pago no puede alcanzar un localhost, y en producción un
 * webhook se puede perder. La pantalla de pago la llama mientras espera.
 *
 * @returns {Promise<{ reserva: object, estado: string, detalle: string|null, reciénConfirmada: boolean }>}
 */
export async function sincronizarPago(reserva) {
  if (reserva.paymentStatus === 'PAGADO') {
    return {
      reserva,
      estado: 'PAGADO',
      detalle: reserva.paymentDetalle,
      reciénConfirmada: false,
    };
  }

  let resultado;
  try {
    resultado = await consultarEstadoDePago(reserva);
  } catch (error) {
    console.error('[pagos] no se pudo consultar el estado de', reserva.codigo, error.message);
    // No se sabe nada nuevo: se devuelve lo que ya había, sin romper la pantalla.
    return {
      reserva,
      estado: reserva.paymentStatus,
      detalle: reserva.paymentDetalle,
      reciénConfirmada: false,
    };
  }

  if (resultado.estado === 'PAGADO') {
    const { reserva: actualizada, reciénConfirmada } = await acreditarSenaYAvisar(reserva.id, {
      pagoId: resultado.pagoId,
      detalle: resultado.detalle,
    });
    return { reserva: actualizada, estado: 'PAGADO', detalle: resultado.detalle, reciénConfirmada };
  }

  const actualizada = await registrarSenaNoAcreditada(reserva.id, {
    estado: resultado.estado,
    detalle: resultado.detalle,
  });

  return {
    reserva: actualizada,
    estado: resultado.estado,
    detalle: resultado.detalle,
    reciénConfirmada: false,
  };
}

/**
 * Arma el checkout de la seña: lo dispara el botón "Pagar la seña" de la
 * pantalla de pago, la primera vez y en cada reintento.
 *
 * Se crea una preferencia nueva cada vez en vez de reusar la anterior: la vieja
 * pudo haber vencido, y de todos modos el monto y los datos se recalculan del
 * mismo lugar. La reserva y su lugar apartado siguen siendo los mismos.
 */
export async function iniciarCobroDeSena(reserva) {
  if (reserva.paymentStatus === 'PAGADO') return reserva;
  if (!pagoOnlineHabilitado()) return reserva;

  const resultado = await crearPreferenciaDePago(reserva);

  if (!resultado.requierePago && resultado.estado === 'PAGADO') {
    const { reserva: actualizada } = await acreditarSenaYAvisar(reserva.id, { pagoId: resultado.ref });
    return actualizada;
  }

  return prisma.reservation.update({
    where: { id: reserva.id },
    data: {
      paymentRef: resultado.ref ?? reserva.paymentRef,
      paymentUrl: resultado.urlPago ?? null,
      paymentStatus: 'PENDIENTE',
      paymentDetalle: null,
    },
    include: INCLUDE_COMPLETO,
  });
}

/** Comprobante público por token. No expone comisión ni datos internos. */
export async function obtenerPorToken(token) {
  const reserva = await prisma.reservation.findUnique({
    // Incluye las quitadas del panel (`eliminadaEn`): el comprobante es del
    // cliente, y que el estacionamiento limpie su listado no se lo invalida.
    where: { publicToken: token, eliminadaEn: { not: undefined } },
    include: INCLUDE_COMPLETO,
  });
  if (!reserva) throw errores.noEncontrado('El comprobante');
  return reserva;
}

/**
 * Datos del cliente tal como quedaron al reservar.
 *
 * Siempre se lee de acá, nunca de `reserva.customer` directo: la fila de
 * Customer es un contacto compartido entre todas las reservas de un mismo
 * teléfono, así que puede haber cambiado después. La reserva es un documento
 * de algo que ya pasó.
 *
 * El `??` cubre las reservas anteriores a que existiera la copia, que se
 * rellenaron en la migración 20260929100000.
 */
export function clienteParaMostrar(reserva) {
  return {
    nombre: reserva.clienteNombre ?? reserva.customer?.nombre ?? '',
    apellido: reserva.clienteApellido ?? reserva.customer?.apellido ?? '',
    email: reserva.clienteEmail ?? reserva.customer?.email ?? null,
    // El teléfono es la clave con la que se identifica al cliente: no cambia
    // sin que cambie de persona, así que se lee del contacto.
    telefono: reserva.customer?.telefono ?? null,
  };
}

/**
 * Nombre del estacionamiento para mostrar, y si sigue existiendo.
 *
 * Una reserva de un estacionamiento eliminado conserva el vínculo (la fila
 * queda como ancla del historial contable), así que la relación sigue trayendo
 * datos y en pantalla parece un estacionamiento activo. Acá se resuelve de una
 * vez: se usa la copia guardada al eliminarlo y se marca la fila.
 */
export function parkingParaMostrar(reserva) {
  const eliminado = Boolean(reserva.parking?.eliminadoEn);
  return {
    nombre: eliminado
      ? reserva.parkingNombre ?? reserva.parking?.nombre ?? 'Estacionamiento eliminado'
      : reserva.parking?.nombre,
    direccion: eliminado
      ? reserva.parkingDireccion ?? reserva.parking?.direccion
      : reserva.parking?.direccion,
    eliminado,
  };
}

/** Vista pública del comprobante: se filtra todo lo que es interno. */
export function aComprobantePublico(reserva) {
  return {
    codigo: reserva.codigo,
    publicToken: reserva.publicToken,
    estado: reserva.estado,
    inicio: reserva.inicio,
    fin: reserva.fin,
    cantidadVehiculos: reserva.cantidadVehiculos,
    precioTotal: aNumero(reserva.precioTotal),
    moneda: reserva.moneda,
    paymentStatus: reserva.paymentStatus,
    // Todo lo que la pantalla de pago necesita para decidir qué mostrar.
    // `esperandoLaSena` es la que manda: mientras sea true no hay reserva.
    pago: {
      estado: reserva.paymentStatus,
      detalle: reserva.paymentDetalle ?? null,
      url: reserva.paymentUrl ?? null,
      esperandoLaSena: esperandoLaSena(reserva),
      pagadaEn: reserva.pagadaEn ?? null,
    },
    subtotal: aNumero(reserva.subtotal),
    // Los tres montos del modelo de seña. `montoComision` es el nombre de la
    // columna; de cara al cliente esto es la seña que ya pagó.
    sena: aNumero(reserva.montoComision),
    aPagarEnElLugar: aNumero(reserva.montoNeto),
    notas: reserva.notas,
    camposExtra: reserva.camposExtra,
    creadaEl: reserva.createdAt,
    checkInAt: reserva.checkInAt,
    checkOutAt: reserva.checkOutAt,
    parking: {
      nombre: reserva.parking.nombre,
      slug: reserva.parking.slug,
      direccion: reserva.parking.direccion,
      barrio: reserva.parking.barrio,
      ciudad: reserva.parking.ciudad,
      lat: reserva.parking.lat,
      lng: reserva.parking.lng,
      telefono: reserva.parking.telefono,
    },
    cliente: {
      nombre: clienteParaMostrar(reserva).nombre,
      apellido: clienteParaMostrar(reserva).apellido,
      telefono: reserva.customer.telefono,
      email: reserva.customer.email,
    },
    vehiculo: {
      patente: reserva.vehicle.patente,
      tipo: reserva.vehicle.tipo,
      marca: reserva.vehicle.marca,
      modelo: reserva.vehicle.modelo,
      color: reserva.vehicle.color,
    },
  };
}

/** Vista para el panel: incluye comisión y neto. */
export function aReservaAdmin(reserva) {
  return {
    id: reserva.id,
    codigo: reserva.codigo,
    publicToken: reserva.publicToken,
    estado: reserva.estado,
    source: reserva.source,
    inicio: reserva.inicio,
    fin: reserva.fin,
    cantidadVehiculos: reserva.cantidadVehiculos,
    precioTotal: aNumero(reserva.precioTotal),
    comisionPorcentaje: aNumero(reserva.comisionPorcentaje),
    montoComision: aNumero(reserva.montoComision),
    montoNeto: aNumero(reserva.montoNeto),
    moneda: reserva.moneda,
    desglosePrecio: reserva.desglosePrecio,
    paymentStatus: reserva.paymentStatus,
    subtotal: aNumero(reserva.subtotal),
    notas: reserva.notas,
    camposExtra: reserva.camposExtra,
    checkInAt: reserva.checkInAt,
    checkOutAt: reserva.checkOutAt,
    canceledAt: reserva.canceledAt,
    motivoCancelacion: reserva.motivoCancelacion,
    createdAt: reserva.createdAt,
    parking: reserva.parking
      ? (() => {
          const p = parkingParaMostrar(reserva);
          return {
            id: reserva.parking.id,
            nombre: p.nombre,
            slug: reserva.parking.slug,
            // El panel lo usa para marcar la fila; el nombre ya viene resuelto.
            eliminado: p.eliminado,
          };
        })()
      : null,
    cliente: reserva.customer
      ? {
          // Nombre y email salen de la copia congelada en la reserva, no del
          // contacto: ese lo comparten todas las reservas del mismo teléfono.
          ...clienteParaMostrar(reserva),
          id: reserva.customer.id,
        }
      : null,
    vehiculo: reserva.vehicle
      ? {
          patente: reserva.vehicle.patente,
          tipo: reserva.vehicle.tipo,
          marca: reserva.vehicle.marca,
          modelo: reserva.vehicle.modelo,
          color: reserva.vehicle.color,
        }
      : null,
  };
}

/**
 * Cambio de estado con validación de transición.
 * @param {string} id
 * @param {'CONFIRMADA'|'EN_CURSO'|'FINALIZADA'|'CANCELADA'|'NO_SHOW'} nuevoEstado
 */
export async function cambiarEstado(id, nuevoEstado, { motivo = null, filtroTenant = {} } = {}) {
  const reserva = await prisma.reservation.findFirst({
    where: { id, ...filtroTenant },
    select: { id: true, estado: true, parkingId: true },
  });

  if (!reserva) throw errores.noEncontrado('La reserva');

  // Mensaje propio para el caso que importa: el genérico ("no se puede pasar
  // de PENDIENTE a EN_CURSO") no le explica al playero por qué.
  if (reserva.estado === SIN_SENA && nuevoEstado !== 'CANCELADA') {
    throw errores.conflicto(
      'Esta reserva todavía no tiene la seña pagada: se confirma sola cuando el pago se acredita. Hasta entonces no se puede hacer check-in ni operar sobre ella.',
      { estadoActual: reserva.estado, transicionesPosibles: ['CANCELADA'] },
    );
  }

  const permitidas = TRANSICIONES[reserva.estado] ?? [];
  if (!permitidas.includes(nuevoEstado)) {
    throw errores.conflicto(
      `No se puede pasar de ${reserva.estado} a ${nuevoEstado}.`,
      { estadoActual: reserva.estado, transicionesPosibles: permitidas },
    );
  }

  const data = { estado: nuevoEstado };
  const ahora = new Date();

  if (nuevoEstado === 'EN_CURSO') data.checkInAt = ahora;
  if (nuevoEstado === 'FINALIZADA') data.checkOutAt = ahora;
  if (nuevoEstado === 'CANCELADA') {
    data.canceledAt = ahora;
    data.motivoCancelacion = motivo;
  }

  return prisma.reservation.update({
    where: { id },
    data,
    include: INCLUDE_COMPLETO,
  });
}

/**
 * Búsqueda rápida por código o patente, pensada para el playero en la entrada.
 * @param {string} termino
 * @param {object} filtroTenant
 */
export async function busquedaRapida(termino, filtroTenant = {}) {
  const limpio = String(termino ?? '').trim();
  if (limpio.length < 3) return [];

  const codigo = normalizarCodigo(limpio);
  const patente = normalizarPatente(limpio);
  const digitos = limpio.replace(/\D/g, '');

  // Se arma el OR solo con los criterios que tienen contenido: un `contains: ''`
  // haría match con absolutamente todo.
  const condiciones = [{ codigo: { contains: limpio.toUpperCase() } }];
  if (codigo) condiciones.push({ codigo: { equals: codigo } });
  if (patente) condiciones.push({ vehicle: { patente: { contains: patente } } });
  if (digitos.length >= 4) condiciones.push({ customer: { telefono: { contains: digitos } } });

  return prisma.reservation.findMany({
    where: {
      ...filtroTenant,
      // El playero busca para hacer check-in: una reserva sin seña no llega.
      ...SOLO_CON_SENA,
      OR: condiciones,
    },
    include: INCLUDE_COMPLETO,
    orderBy: { inicio: 'desc' },
    take: 10,
  });
}

export { TRANSICIONES };
export default { crearReserva, obtenerPorToken, cambiarEstado, busquedaRapida };
