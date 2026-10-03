/**
 * Adaptador de email.
 *
 * Dos proveedores, elegidos solos según qué credenciales haya cargadas:
 *
 *  · Resend (RESEND_API_KEY)                 → una API key y listo. Es el camino
 *    corto para un proyecto nuevo: no hace falta servidor de correo ni puertos.
 *    No agrega dependencias: es un POST con `fetch`.
 *  · SMTP (SMTP_HOST + SMTP_USER + SMTP_PASS) → Nodemailer. Sirve para Gmail,
 *    un hosting propio o cualquier casilla que ya exista.
 *
 * Si no hay ninguna de las dos, el sistema NO rompe: loguea el mail en consola
 * y lo marca como SIMULADO, así el flujo completo se puede probar sin
 * configurar nada. Ese modo avisa fuerte para que nadie crea que salió.
 *
 * Un envío fallido nunca tira abajo el flujo que lo pidió (una reserva no se
 * cae porque el mail no salió), pero sí deja un error visible en el servidor y
 * un registro en NotificationLog: fallar en silencio es lo único que no se
 * puede hacer acá.
 */
import nodemailer from 'nodemailer';
import env from '../../config/env.js';

let transporteCacheado = null;

function obtenerTransporte() {
  if (transporteCacheado) return transporteCacheado;
  if (!env.smtpHabilitado) return null;

  transporteCacheado = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE, // true para 465, false para 587 con STARTTLS
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });

  return transporteCacheado;
}

/** Deja el fallo bien visible en el servidor, con el contexto para diagnosticarlo. */
function registrarFallo(proveedor, { destino, asunto }, error) {
  console.error(
    [
      '',
      '📧 ✗ ─────────────────────────────────────────────',
      `   NO SE PUDO ENVIAR EL EMAIL (${proveedor})`,
      `   Para:    ${destino}`,
      `   Asunto:  ${asunto}`,
      `   Motivo:  ${error}`,
      '   El flujo que lo pidió siguió igual; esto es solo el aviso.',
      '────────────────────────────────────────────────',
      '',
    ].join('\n'),
  );
}

/**
 * Remitente de prueba de Resend. Sirve sin verificar ningún dominio, pero solo
 * puede mandar a la casilla con la que se creó la cuenta de Resend.
 */
export const REMITENTE_DE_PRUEBA_RESEND = 'SpotNear <onboarding@resend.dev>';

/** ¿Resend rechazó el remitente porque su dominio todavía no está verificado? */
const dominioSinVerificar = (status, mensaje) =>
  status === 403 && /domain is not verified/i.test(mensaje ?? '');

/** ¿Resend está en modo prueba y el destinatario no es el dueño de la cuenta? */
export const esRestriccionDeModoPrueba = (mensaje) =>
  /only send testing emails to your own email/i.test(mensaje ?? '');

/**
 * Resend: un POST a su API con la key en el header.
 *
 * Si el dominio de MAIL_FROM todavía no está verificado en Resend, reintenta
 * una vez desde su remitente de prueba (onboarding@resend.dev). Es lo que hace
 * que cargar solo RESEND_API_KEY alcance para que los mails empiecen a salir:
 * verificar el dominio propio es un paso aparte, para producción.
 *
 * @param {{ destino: string, asunto: string, html: string, texto?: string, adjuntos?: Array }} params
 */
async function enviarPorResend({ destino, asunto, html, texto, adjuntos }, remitente = env.MAIL_FROM) {
  try {
    const respuesta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: remitente,
        to: [destino],
        subject: asunto,
        html,
        text: texto,
        // Resend espera el contenido en base64; nodemailer acepta Buffer.
        attachments: adjuntos.map((a) => ({
          filename: a.filename,
          content: Buffer.isBuffer(a.content)
            ? a.content.toString('base64')
            : a.content,
        })),
      }),
    });

    const datos = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
      const motivo = datos?.message ?? `HTTP ${respuesta.status}`;

      if (dominioSinVerificar(respuesta.status, motivo) && remitente !== REMITENTE_DE_PRUEBA_RESEND) {
        console.warn(
          `[email] el dominio de MAIL_FROM (${remitente}) no está verificado en Resend: ` +
            `se manda desde ${REMITENTE_DE_PRUEBA_RESEND}. Verificalo en resend.com/domains para producción.`,
        );
        return enviarPorResend({ destino, asunto, html, texto, adjuntos }, REMITENTE_DE_PRUEBA_RESEND);
      }

      registrarFallo('resend', { destino, asunto }, motivo);
      return { enviado: false, estado: 'FALLIDO', proveedor: 'resend', error: motivo };
    }

    return { enviado: true, estado: 'ENVIADO', proveedor: 'resend', idExterno: datos?.id };
  } catch (error) {
    registrarFallo('resend', { destino, asunto }, error.message);
    return { enviado: false, estado: 'FALLIDO', proveedor: 'resend', error: error.message };
  }
}

/**
 * @param {{ destino: string, asunto: string, html: string, texto?: string, adjuntos?: Array }} params
 * @returns {Promise<import('./whatsapp.js').ResultadoEnvio>}
 */
export async function enviarEmail({ destino, asunto, html, texto, adjuntos = [] }) {
  if (!destino) {
    return { enviado: false, estado: 'FALLIDO', proveedor: 'ninguno', error: 'Sin destinatario.' };
  }

  if (env.resendHabilitado) {
    return enviarPorResend({ destino, asunto, html, texto, adjuntos });
  }

  const transporte = obtenerTransporte();

  if (!transporte) {
    // Modo simulado: queda constancia en consola y en NotificationLog.
    console.warn(
      [
        '',
        '📧 ─────────────────────────────────────────────',
        '   EMAIL SIMULADO — NO SE ENVIÓ NADA',
        `   Para:    ${destino}`,
        `   Asunto:  ${asunto}`,
        '',
        '   Para que salga de verdad, cargá en backend/.env una de las dos:',
        '     · RESEND_API_KEY=re_...                    (más simple)',
        '     · SMTP_HOST + SMTP_USER + SMTP_PASS        (casilla propia)',
        '────────────────────────────────────────────────',
        '',
      ].join('\n'),
    );
    return { enviado: false, estado: 'SIMULADO', proveedor: 'consola' };
  }

  try {
    const info = await transporte.sendMail({
      from: env.MAIL_FROM,
      to: destino,
      subject: asunto,
      html,
      text: texto,
      attachments: adjuntos,
    });

    return { enviado: true, estado: 'ENVIADO', proveedor: 'smtp', idExterno: info.messageId };
  } catch (error) {
    registrarFallo('smtp', { destino, asunto }, error.message);
    return { enviado: false, estado: 'FALLIDO', proveedor: 'smtp', error: error.message };
  }
}

/** Estado del canal de email, para el endpoint de salud y el arranque. */
export async function verificarEmail() {
  if (env.resendHabilitado) return { proveedor: 'resend', configurado: true, ok: true };

  const transporte = obtenerTransporte();
  if (!transporte) return { proveedor: 'ninguno', configurado: false, ok: false };

  try {
    await transporte.verify();
    return { proveedor: 'smtp', configurado: true, ok: true };
  } catch (error) {
    return { proveedor: 'smtp', configurado: true, ok: false, error: error.message };
  }
}

/** Nombre viejo, conservado para no romper a quien lo importe. */
export const verificarSMTP = verificarEmail;

export default { enviarEmail, verificarEmail, verificarSMTP };
