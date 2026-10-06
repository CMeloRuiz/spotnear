/**
 * Verificación del email en el alta por autogestión.
 *
 *   formulario → PENDIENTE_VERIFICACION ──(clic en el link del email)──▶
 *                PENDIENTE_APROBACION ──(el SUPERADMIN revisa)──▶ ACTIVO / RECHAZADO
 *
 * Mientras el email no se confirma, la solicitud no existe para ColdevIA: no
 * aparece en Solicitudes ni en Estacionamientos. Así se confirma que el email
 * es real y es de quien se registra antes de que alguien la revise.
 *
 * El token es aleatorio (32 bytes) y viaja solo en el link. En la base se
 * guarda su SHA-256, igual que los refresh tokens: alguien que lea la base no
 * puede armar el link. Vence a las HORAS_DE_VALIDEZ; pedir un reenvío genera
 * uno nuevo y el anterior deja de servir.
 */
import crypto from 'node:crypto';
import prisma from '../../config/prisma.js';
import env from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import { enviarEmail } from '../../services/notifications/email.js';
import { emailVerificacionAlta } from '../../services/notifications/messages.js';
import { notificarAltaEstacionamiento } from '../../services/notifications/index.js';

export const HORAS_DE_VALIDEZ = 48;

export const hashDeToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/** Token nuevo: lo que va en el link y lo que se guarda en la base. */
export function nuevoToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  return {
    token,
    hash: hashDeToken(token),
    expiraEn: new Date(Date.now() + HORAS_DE_VALIDEZ * 3_600_000),
  };
}

export const enlaceDeVerificacion = (token) => `${env.PUBLIC_WEB_URL}/verificar-email/${token}`;

/**
 * Manda el email con el link. Nunca lanza: un fallo de mail no deshace la
 * solicitud (el dueño puede pedir el reenvío).
 *
 * Fuera de producción, si el email no salió (no está configurado, o Resend en
 * modo prueba no deja mandarle a esa casilla), devuelve el link en
 * `enlaceDePrueba` para poder probar el flujo completo en desarrollo. En
 * producción nunca se devuelve: el link solo viaja por email.
 */
export async function enviarEmailDeVerificacion({ owner, parking, token }) {
  const enlace = enlaceDeVerificacion(token);
  let resultado;
  try {
    const { asunto, html } = emailVerificacionAlta({ owner, parking, enlace, horas: HORAS_DE_VALIDEZ });
    resultado = await enviarEmail({ destino: owner.email, asunto, html });
  } catch (error) {
    console.error('[verificación] no se pudo mandar el email:', error.message);
    resultado = { enviado: false, estado: 'FALLIDO', error: error.message };
  }
  return {
    estado: resultado.estado,
    enlaceDePrueba: !env.isProd && resultado.estado !== 'ENVIADO' ? enlace : undefined,
  };
}

/**
 * Confirma el email con el token del link.
 *
 * @returns {Promise<{ estado: string, yaVerificado: boolean }>}
 * @throws 400 TOKEN_INVALIDO · 410 TOKEN_VENCIDO
 */
export async function verificarEmail(token) {
  const usuario = await prisma.user.findUnique({
    where: { verificacionTokenHash: hashDeToken(token) },
    include: { parking: true },
  });

  if (!usuario || !usuario.parking) {
    throw new AppError(
      'El link no es válido. Puede que hayas pedido uno nuevo después: usá el último que te mandamos.',
      400,
      'TOKEN_INVALIDO',
    );
  }

  // Volver a abrir el link ya usado no es un error: se le dice dónde está.
  if (usuario.emailVerificadoEn) {
    return { estado: usuario.parking.estado, yaVerificado: true };
  }

  if (!usuario.verificacionExpiraEn || usuario.verificacionExpiraEn < new Date()) {
    throw new AppError(
      `El link venció (dura ${HORAS_DE_VALIDEZ} horas). Pedí uno nuevo y te lo mandamos al mismo email.`,
      410,
      'TOKEN_VENCIDO',
    );
  }

  const parking = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: usuario.id },
      // El hash se conserva: si vuelve a abrir el link, se le responde "ya
      // confirmado" en vez de "link inválido".
      data: { emailVerificadoEn: new Date() },
    });
    // Solo pasa a revisión si seguía esperando la verificación: un link viejo
    // nunca puede "des-aprobar" ni "des-rechazar" nada.
    await tx.parking.updateMany({
      where: { id: usuario.parkingId, estado: 'PENDIENTE_VERIFICACION' },
      data: { estado: 'PENDIENTE_APROBACION' },
    });
    return tx.parking.findUnique({ where: { id: usuario.parkingId } });
  });

  // Recién ahora la solicitud entra en revisión: el acuse de "la revisamos en
  // menos de 24 horas" sale acá y no al completar el formulario.
  await notificarAltaEstacionamiento('recibida', {
    parking,
    owner: { nombre: usuario.nombre, email: usuario.email },
  });

  return { estado: parking.estado, yaVerificado: false, parkingId: parking.id, email: usuario.email };
}

/**
 * Reenvía el link. La respuesta es la misma exista o no la solicitud, para no
 * revelar qué emails están registrados.
 *
 * @returns {Promise<{ enlaceDePrueba?: string }>}
 */
export async function reenviarVerificacion(email) {
  const usuario = await prisma.user.findUnique({
    where: { email },
    include: { parking: true },
  });
  const pendiente =
    usuario && !usuario.emailVerificadoEn && usuario.parking?.estado === 'PENDIENTE_VERIFICACION';
  if (!pendiente) return {};

  const { token, hash, expiraEn } = nuevoToken();
  await prisma.user.update({
    where: { id: usuario.id },
    data: { verificacionTokenHash: hash, verificacionExpiraEn: expiraEn },
  });

  const envio = await enviarEmailDeVerificacion({
    owner: { nombre: usuario.nombre, email: usuario.email },
    parking: usuario.parking,
    token,
  });
  return { enlaceDePrueba: envio.enlaceDePrueba };
}
