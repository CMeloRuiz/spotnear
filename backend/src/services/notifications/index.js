/**
 * Orquestador de notificaciones.
 *
 * Toda salida (WhatsApp o email) pasa por acá y queda registrada en
 * NotificationLog, aunque haya sido simulada o haya fallado. Sirve para saber
 * después "¿al cliente le llegó el comprobante?" sin adivinar.
 *
 * Importante: un fallo notificando NUNCA hace fallar la reserva. La reserva ya
 * está hecha; el mail es un extra.
 */
import prisma from '../../config/prisma.js';
import env from '../../config/env.js';
import { enviarWhatsApp, linkWhatsApp, envioAutomatico } from './whatsapp.js';
import { enviarEmail } from './email.js';
import { comprobantePng } from '../comprobante-imagen.js';
import {
  mensajeClienteWhatsApp,
  mensajeGrupoWhatsApp,
  mensajeResumenDelDia,
  pieComprobanteWhatsApp,
  emailComprobanteHTML,
  CID_COMPROBANTE,
  emailComprobanteTexto,
  asuntoEmail,
  urlComprobante,
  urlComprobanteImagen,
  urlComoLlegar,
  emailSolicitudRecibida,
  emailSolicitudAprobada,
  emailSolicitudRechazada,
} from './messages.js';

/** Deja constancia del intento, sin romper si falla el log. */
async function registrar({ reservationId, canal, destino, resultado, asunto, payload }) {
  try {
    await prisma.notificationLog.create({
      data: {
        reservationId: reservationId ?? null,
        canal,
        destino: destino ?? '',
        estado: resultado.estado,
        asunto: asunto ?? null,
        proveedor: resultado.proveedor ?? null,
        error: resultado.error ?? null,
        payload: payload ?? undefined,
      },
    });
  } catch (error) {
    console.error('[notificaciones] no se pudo registrar el envío:', error.message);
  }
}

/**
 * La imagen del comprobante, en las dos formas que piden los proveedores: la
 * URL pública (Twilio la descarga) y el PNG (cloud_api lo sube). El PNG se
 * genera solo si un proveedor lo pide.
 */
function imagenDelComprobante(reserva) {
  return { imagenUrl: urlComprobanteImagen(reserva), imagenPng: () => comprobantePng(reserva) };
}

/**
 * Manda el comprobante al WhatsApp del cliente: la IMAGEN del comprobante
 * (la misma de la vista web, con el QR) como adjunto real, con un pie corto.
 * Es lo que usa el botón "Enviar a mi WhatsApp" y el envío automático cuando
 * se acredita la seña.
 *
 * Con el proveedor wa.me no se puede adjuntar nada: queda PENDIENTE, con el
 * texto completo en el link, y el botón del comprobante avisa que el envío no
 * está configurado.
 *
 * @param {object} reserva Con parking, customer y vehicle incluidos.
 */
export async function notificarClienteWhatsApp(reserva) {
  const automatico = envioAutomatico();
  // Por la API va la imagen con un pie corto. En wa.me, el texto largo: es lo
  // único que ese link puede llevar.
  const texto = automatico ? pieComprobanteWhatsApp(reserva) : mensajeClienteWhatsApp(reserva);
  const { imagenUrl, imagenPng } = imagenDelComprobante(reserva);
  const resultado = await enviarWhatsApp({
    destino: reserva.customer.telefono,
    texto,
    imagenUrl,
    imagenPng,
  });

  await registrar({
    reservationId: reserva.id,
    canal: 'WHATSAPP',
    destino: reserva.customer.telefono,
    resultado,
    payload: { texto, imagenUrl },
  });

  return { ...resultado, texto, link: resultado.link ?? linkWhatsApp(reserva.customer.telefono, texto) };
}

/**
 * Manda (o prepara) el aviso al grupo de WhatsApp del estacionamiento.
 */
export async function notificarGrupoWhatsApp(reserva) {
  const texto = mensajeGrupoWhatsApp(reserva);

  // WHATSAPP_GRUPO_PRUEBA pisa el número del estacionamiento mientras se
  // prueba la integración. En producción se deja vacío y cada estacionamiento
  // recibe el aviso en su propio grupo, que es para lo que existe la columna.
  const destino = env.WHATSAPP_GRUPO_PRUEBA || reserva.parking?.whatsappGrupo || '';

  let resultado;

  if (!destino) {
    // Sin número igual devolvemos el link: wa.me abre el selector de chats y el
    // encargado elige el grupo a mano.
    resultado = {
      enviado: false,
      estado: 'PENDIENTE',
      proveedor: 'wa.me',
      link: linkWhatsApp('', texto),
    };
    console.warn(
      `[whatsapp] la reserva ${reserva.codigo} no tiene grupo al que avisar: ` +
        'cargá el WhatsApp del estacionamiento en el panel, o WHATSAPP_GRUPO_PRUEBA en el .env.',
    );
  } else {
    // El texto del grupo va como pie de la imagen del comprobante: el playero
    // ve el QR que le van a mostrar y, abajo, lo que tiene que cobrar.
    resultado = await enviarWhatsApp({ destino, texto, ...imagenDelComprobante(reserva) });

    // Si la imagen no se pudo adjuntar (Twilio sin URL pública, por ejemplo),
    // el aviso sale igual, solo con el texto: al grupo le importa enterarse de
    // la reserva, y eso no puede depender de la imagen.
    if (!resultado.enviado && envioAutomatico()) {
      console.warn(`[whatsapp] el aviso al grupo sale sin imagen: ${resultado.error}`);
      resultado = await enviarWhatsApp({ destino, texto });
    }

    if (!envioAutomatico()) {
      console.info(
        `[whatsapp] aviso de la reserva ${reserva.codigo} PREPARADO pero NO enviado: ` +
          'wa.me solo arma el mensaje y necesita que una persona lo mande. ' +
          'Para que salga solo, configurá WHATSAPP_PROVIDER=twilio con las credenciales de Twilio.',
      );
    } else if (resultado.enviado) {
      console.info(
        `[whatsapp] aviso de la reserva ${reserva.codigo} enviado automáticamente a ${destino} (${resultado.proveedor}).`,
      );
    }
  }

  await registrar({
    reservationId: reserva.id,
    canal: 'WHATSAPP',
    destino: destino || '(grupo sin número cargado)',
    resultado,
    payload: { texto, tipo: 'grupo', automatico: envioAutomatico() },
  });

  return { ...resultado, texto, link: resultado.link ?? linkWhatsApp(destino, texto) };
}

/**
 * Email de UNA reserva: el que el cliente escribió en el formulario de esa
 * reserva (copia congelada en `clienteEmail`). El del contacto (Customer) es
 * solo el respaldo de reservas viejas: ese se comparte entre todas las
 * reservas con el mismo teléfono y guarda el primer email que se usó, así que
 * usarlo mandaba el comprobante a la casilla de otra persona.
 */
export function emailDeLaReserva(reserva) {
  return reserva.clienteEmail ?? reserva.customer?.email ?? null;
}

/**
 * Envía el comprobante por email. Si no hay SMTP configurado, queda SIMULADO.
 * @param {object} reserva
 * @param {{ destino?: string }} [opciones]  Otra casilla elegida por el cliente
 */
export async function notificarClienteEmail(reserva, { destino: otraCasilla } = {}) {
  const destino = otraCasilla ?? emailDeLaReserva(reserva);
  if (!destino) {
    return { enviado: false, estado: 'PENDIENTE', proveedor: null, error: 'El cliente no dejó email.' };
  }

  // La imagen del comprobante es el email: va embebida en el cuerpo (cid) y,
  // además, adjunta. Es el mismo PNG de "Guardar imagen" y de WhatsApp
  // (services/comprobante-imagen.js), no una versión aparte.
  let adjuntos = [];
  try {
    adjuntos = [
      {
        filename: `spotnear-${reserva.codigo}.png`,
        content: await comprobantePng(reserva),
        cid: CID_COMPROBANTE,
      },
    ];
  } catch (error) {
    console.error('[notificaciones] no se pudo generar la imagen del comprobante:', error.message);
  }

  const asunto = asuntoEmail(reserva);
  const html = emailComprobanteHTML(reserva, { conImagen: adjuntos.length > 0 });
  const texto = emailComprobanteTexto(reserva);

  const resultado = await enviarEmail({
    destino,
    asunto,
    html,
    texto,
    adjuntos,
  });

  await registrar({
    reservationId: reserva.id,
    canal: 'EMAIL',
    destino,
    resultado,
    asunto,
  });

  return resultado;
}

/**
 * Emails del alta de estacionamientos.
 *
 * No se registran en NotificationLog porque esa tabla cuelga de una reserva
 * (reservationId) y acá todavía no hay ninguna. Igual que con las reservas, un
 * fallo de mail NUNCA hace fallar la operación: la solicitud ya quedó guardada.
 *
 * @param {'recibida'|'aprobada'|'rechazada'} tipo
 * @param {{ parking: object, owner: object, motivo?: string }} datos
 */
export async function notificarAltaEstacionamiento(tipo, datos) {
  const plantillas = {
    recibida: emailSolicitudRecibida,
    aprobada: emailSolicitudAprobada,
    rechazada: emailSolicitudRechazada,
  };

  const armar = plantillas[tipo];
  if (!armar) throw new Error(`Tipo de aviso desconocido: ${tipo}`);
  if (!datos.owner?.email) {
    return { enviado: false, estado: 'PENDIENTE', proveedor: null, error: 'El dueño no dejó email.' };
  }

  try {
    const { asunto, html } = armar(datos);
    return await enviarEmail({ destino: datos.owner.email, asunto, html });
  } catch (error) {
    console.error(`[notificaciones] alta de estacionamiento (${tipo}):`, error.message);
    return { enviado: false, estado: 'FALLIDO', proveedor: null, error: error.message };
  }
}

/**
 * Se dispara al crear una reserva. Nunca lanza: los errores se loguean.
 * @returns {Promise<{ whatsappCliente: object, whatsappGrupo: object, email: object|null }>}
 */
export async function notificarReservaCreada(reserva) {
  const resultados = { whatsappCliente: null, whatsappGrupo: null, email: null };

  try {
    resultados.whatsappCliente = await notificarClienteWhatsApp(reserva);
  } catch (error) {
    console.error('[notificaciones] WhatsApp cliente:', error.message);
  }

  try {
    resultados.whatsappGrupo = await notificarGrupoWhatsApp(reserva);
  } catch (error) {
    console.error('[notificaciones] WhatsApp grupo:', error.message);
  }

  if (emailDeLaReserva(reserva)) {
    try {
      resultados.email = await notificarClienteEmail(reserva);
    } catch (error) {
      console.error('[notificaciones] email:', error.message);
    }
  }

  return resultados;
}

export {
  mensajeClienteWhatsApp,
  mensajeGrupoWhatsApp,
  mensajeResumenDelDia,
  pieComprobanteWhatsApp,
  envioAutomatico,
  linkWhatsApp,
  urlComprobante,
  urlComprobanteImagen,
  urlComoLlegar,
};

export default {
  notificarAltaEstacionamiento,
  notificarReservaCreada,
  notificarClienteWhatsApp,
  notificarGrupoWhatsApp,
  notificarClienteEmail,
};
