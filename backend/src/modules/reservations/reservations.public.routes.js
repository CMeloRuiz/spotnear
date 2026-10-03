/**
 * Rutas públicas de reservas: /api/v1/reservations
 * Se puede reservar como invitado, sin crear cuenta.
 */
import { Router } from 'express';
import { z } from 'zod';
import * as servicio from './reservations.service.js';
import validar from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/error.js';
import { AppError } from '../../utils/errors.js';
import { limiteReservas } from '../../middleware/rateLimit.js';
import {
  texto,
  textoOpcional,
  patente,
  telefono,
  emailOpcional,
  vehicleType,
} from '../shared/schemas.js';
import { formatearTelefono } from '../../utils/phone.js';
import { esRestriccionDeModoPrueba } from '../../services/notifications/email.js';
import {
  notificarReservaCreada,
  notificarClienteEmail,
  notificarClienteWhatsApp,
  envioAutomatico,
  mensajeClienteWhatsApp,
  linkWhatsApp,
  urlComprobante,
  urlComoLlegar,
} from '../../services/notifications/index.js';
import { qrDataUrl, qrSvg } from '../../services/qr.js';
import { comprobantePng } from '../../services/comprobante-imagen.js';

const router = Router();

/**
 * Lo que se responde cuando alguien pide el QR o la imagen de una reserva cuya
 * seña todavía no entró. No existen: el comprobante se emite con la seña.
 */
const errorSinSena = () =>
  new AppError(
    'Todavía no pagaste la seña de esta reserva, así que no hay comprobante.',
    409,
    'SENA_PENDIENTE',
  );

const fecha = (etiqueta) =>
  z
    .string({ required_error: `${etiqueta} es obligatoria.` })
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: `${etiqueta} no es una fecha válida.` })
    .transform((v) => new Date(v));

/** Datos del cliente y del vehículo: lo que hoy se pide a mano por WhatsApp. */
export const esquemaReservaPublica = z
  .object({
    parkingId: z.string({ required_error: 'Elegí un estacionamiento.' }).min(1),
    inicio: fecha('La hora de ingreso'),
    fin: fecha('La hora de salida'),
    modalidad: z.enum(['HORARIO', 'MENSUAL']).default('HORARIO'),

    // ── Obligatorios ──
    cliente: z.object({
      nombre: texto(60, 'El nombre'),
      apellido: texto(60, 'El apellido'),
      telefono,
      email: emailOpcional,
    }),
    vehiculo: z.object({
      patente,
      tipo: vehicleType.default('AUTO'),
      marca: textoOpcional(40),
      modelo: textoOpcional(40),
      color: textoOpcional(30),
    }),

    // ── Opcionales ──
    cantidadVehiculos: z.coerce.number().int().min(1).max(20).default(1),
    // Clave de reintento. La manda el cliente para que, si el POST muere en la
    // red y se vuelve a intentar, no se cree una reserva duplicada.
    idempotencyKey: z.string().trim().min(8).max(80).optional(),
    notas: textoOpcional(500),
    camposExtra: z.record(z.unknown()).default({}),
  })
  .superRefine((d, ctx) => {
    if (d.fin <= d.inicio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fin'],
        message: 'La hora de salida tiene que ser posterior a la de ingreso.',
      });
    }
    const dias = (d.fin - d.inicio) / 86_400_000;
    if (dias > 90) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fin'],
        message: 'La reserva no puede superar los 90 días.',
      });
    }
  });

/**
 * Arma la respuesta del comprobante: datos públicos + QR + links de compartir.
 *
 * Mientras la seña no esté acreditada NO hay comprobante: sin QR y sin los
 * links para compartir. Ese es el sentido del modelo —sin seña no hay reserva—
 * y también evita el caso feo de alguien mostrando en la entrada un QR de algo
 * que nunca pagó. La pantalla de pago se encarga de ese estado.
 */
async function armarComprobante(reserva, { incluirQr = true } = {}) {
  const publico = servicio.aComprobantePublico(reserva);

  if (servicio.esperandoLaSena(reserva)) {
    return { reserva: publico, qr: null, links: null, mensajeWhatsApp: null };
  }

  const textoWhatsApp = mensajeClienteWhatsApp(reserva);

  return {
    reserva: publico,
    qr: incluirQr ? await qrDataUrl(reserva).catch(() => null) : null,
    links: {
      comprobante: urlComprobante(reserva),
      comoLlegar: urlComoLlegar(reserva.parking),
      // wa.me al número del cliente, con el comprobante ya escrito
      whatsappCliente: linkWhatsApp(reserva.customer.telefono, textoWhatsApp),
      // wa.me sin destinatario: abre el selector para compartirlo con quien sea
      whatsappCompartir: linkWhatsApp('', textoWhatsApp),
    },
    mensajeWhatsApp: textoWhatsApp,
  };
}

/**
 * POST /api/v1/reservations
 * Crea una reserva como invitado y devuelve el comprobante completo.
 */
router.post(
  '/',
  limiteReservas,
  validar({ body: esquemaReservaPublica }),
  asyncHandler(async (req, res) => {
    const reserva = await servicio.crearReserva({ ...req.body, source: 'WEB' });

    // ── Falta la seña: no hay comprobante todavía ──
    //
    // Se devuelve el link al checkout de la pasarela y nada más. Ni comprobante
    // ni QR ni aviso al estacionamiento: todo eso sale recién cuando el pago se
    // confirme (ver payments.routes.js → acreditarYAvisar).
    if (servicio.esperandoLaSena(reserva)) {
      return res.status(201).json({
        ...(await armarComprobante(reserva)),
        pago: {
          requerido: true,
          url: reserva.paymentUrl ?? null,
          estado: reserva.paymentStatus,
          // A dónde mandar al cliente cuando vuelva del checkout.
          seguimiento: `/pago/${reserva.publicToken}`,
        },
        notificaciones: null,
      });
    }

    // Las notificaciones no pueden hacer fallar la reserva: ya está hecha.
    const notificaciones = await notificarReservaCreada(reserva).catch((error) => {
      console.error('[reservas] fallaron las notificaciones:', error.message);
      return null;
    });

    const comprobante = await armarComprobante(reserva);

    return res.status(201).json({
      ...comprobante,
      pago: { requerido: false, url: null, estado: reserva.paymentStatus, seguimiento: null },
      notificaciones: notificaciones
        ? {
            emailEnviado: notificaciones.email?.enviado ?? false,
            emailEstado: notificaciones.email?.estado ?? null,
          }
        : null,
    });
  }),
);

/**
 * GET /api/v1/reservations/comprobante/:token/pago
 *
 * Estado del cobro de la seña. Es lo que consulta la pantalla de pago mientras
 * espera, y la que hace que el flujo no dependa del webhook: cada consulta le
 * pregunta a la pasarela y, si el pago está aprobado, confirma la reserva y
 * dispara el comprobante y el aviso al estacionamiento en ese mismo momento.
 */
router.get(
  '/comprobante/:token/pago',
  validar({ params: z.object({ token: z.string().min(20, 'Comprobante inválido.') }) }),
  asyncHandler(async (req, res) => {
    const reserva = await servicio.obtenerPorToken(req.params.token);

    // Si el pago está aprobado, esto confirma la reserva y dispara el
    // comprobante y el aviso al estacionamiento por dentro (una sola vez,
    // aunque el webhook llegue en paralelo). Ver acreditarSenaYAvisar.
    const resultado = await servicio.sincronizarPago(reserva);
    const actual = resultado.reserva ?? reserva;

    res.json({
      codigo: actual.codigo,
      estadoReserva: actual.estado,
      estado: resultado.estado,
      detalle: resultado.detalle,
      url: actual.paymentUrl ?? null,
      esperandoLaSena: servicio.esperandoLaSena(actual),
      sena: Number(actual.montoComision),
      aPagarEnElLugar: Number(actual.montoNeto),
      moneda: actual.moneda,
    });
  }),
);

/**
 * POST /api/v1/reservations/comprobante/:token/pagar-sena
 * Arma el checkout de la seña y devuelve el link. Lo dispara el botón "Pagar la
 * seña" (la primera vez y en cada reintento): nada manda al cliente a la
 * pasarela sin ese clic.
 */
router.post(
  '/comprobante/:token/pagar-sena',
  limiteReservas,
  validar({ params: z.object({ token: z.string().min(20, 'Comprobante inválido.') }) }),
  asyncHandler(async (req, res) => {
    const reserva = await servicio.obtenerPorToken(req.params.token);

    if (!servicio.esperandoLaSena(reserva)) {
      return res.status(409).json({
        error: {
          codigo: 'SENA_YA_PAGADA',
          mensaje: 'Esta reserva ya está confirmada: la seña se acreditó.',
        },
      });
    }

    const actualizada = await servicio.iniciarCobroDeSena(reserva);

    return res.json({
      url: actualizada.paymentUrl ?? null,
      estado: actualizada.paymentStatus,
      esperandoLaSena: servicio.esperandoLaSena(actualizada),
    });
  }),
);

/**
 * GET /api/v1/reservations/comprobante/:token
 * Link público y seguro del comprobante (token no adivinable).
 */
router.get(
  '/comprobante/:token',
  validar({ params: z.object({ token: z.string().min(20, 'Comprobante inválido.') }) }),
  asyncHandler(async (req, res) => {
    const reserva = await servicio.obtenerPorToken(req.params.token);
    res.json(await armarComprobante(reserva));
  }),
);

/**
 * GET /api/v1/reservations/comprobante/:token/qr.svg
 * QR en SVG, para imprimir sin que se pixele.
 */
router.get(
  '/comprobante/:token/qr.svg',
  validar({ params: z.object({ token: z.string().min(20) }) }),
  asyncHandler(async (req, res) => {
    const reserva = await servicio.obtenerPorToken(req.params.token);
    if (servicio.esperandoLaSena(reserva)) throw errorSinSena();
    const svg = await qrSvg(reserva);
    res.type('image/svg+xml').set('Cache-Control', 'private, max-age=3600').send(svg);
  }),
);

/**
 * GET /api/v1/reservations/comprobante/:token/comprobante.png
 *
 * El comprobante como imagen. Es lo que se enlaza en el WhatsApp del cliente
 * (ver urlComprobanteImagen) y lo que Meta descarga para adjuntarlo. Público
 * como el resto del comprobante: protege el token, no una sesión.
 */
router.get(
  '/comprobante/:token/comprobante.png',
  validar({ params: z.object({ token: z.string().min(20) }) }),
  asyncHandler(async (req, res) => {
    const reserva = await servicio.obtenerPorToken(req.params.token);
    if (servicio.esperandoLaSena(reserva)) throw errorSinSena();
    const png = await comprobantePng(reserva);

    res
      .type('image/png')
      // Una reserva confirmada no cambia, y WhatsApp/Meta piden la imagen
      // varias veces: conviene que la cacheen.
      .set('Cache-Control', 'public, max-age=86400')
      .set('Content-Disposition', `inline; filename="spotnear-${reserva.codigo}.png"`)
      .send(png);
  }),
);

/**
 * POST /api/v1/reservations/comprobante/:token/enviar-whatsapp
 *
 * El botón "Enviar a mi WhatsApp" del comprobante. Manda la IMAGEN del
 * comprobante —la misma de la vista web, con el QR— como adjunto real, por la
 * API de WhatsApp configurada (Twilio o Cloud API), al teléfono que el cliente
 * cargó en la reserva. Nunca a otro número: el destino no viene en el pedido.
 *
 * Sin proveedor automático no hay forma de adjuntar una imagen (wa.me solo
 * prellena texto), así que se avisa que no está disponible en vez de abrir un
 * mensaje de texto, que es justo lo que este botón dejó de hacer.
 */
router.post(
  '/comprobante/:token/enviar-whatsapp',
  limiteReservas,
  validar({ params: z.object({ token: z.string().min(20) }) }),
  asyncHandler(async (req, res) => {
    const reserva = await servicio.obtenerPorToken(req.params.token);
    if (servicio.esperandoLaSena(reserva)) throw errorSinSena();

    if (!envioAutomatico()) {
      return res.json({
        ok: false,
        estado: 'NO_CONFIGURADO',
        mensaje:
          'El envío por WhatsApp todavía no está configurado en este entorno. Podés guardar la imagen del comprobante con "Guardar imagen".',
      });
    }

    const resultado = await notificarClienteWhatsApp(reserva);

    res.json({
      ok: resultado.enviado,
      estado: resultado.estado,
      mensaje: resultado.enviado
        ? `Te mandamos el comprobante al WhatsApp ${formatearTelefono(reserva.customer.telefono)}.`
        : 'No pudimos mandarlo por WhatsApp. Probá de nuevo en un rato o guardá la imagen desde esta pantalla.',
    });
  }),
);

/**
 * POST /api/v1/reservations/comprobante/:token/enviar-email
 * Reenvía el comprobante por email (o lo manda a una dirección distinta).
 */
router.post(
  '/comprobante/:token/enviar-email',
  limiteReservas,
  validar({
    params: z.object({ token: z.string().min(20) }),
    body: z.object({ email: emailOpcional }),
  }),
  asyncHandler(async (req, res) => {
    const reserva = await servicio.obtenerPorToken(req.params.token);

    // Si mandan un email distinto, se usa ese (sin pisar el de la reserva).
    const destino = req.body.email ?? reserva.customer.email;
    if (!destino) {
      return res.status(422).json({
        error: { codigo: 'SIN_EMAIL', mensaje: 'Indicá a qué email querés que lo mandemos.' },
      });
    }

    const resultado = await notificarClienteEmail({
      ...reserva,
      customer: { ...reserva.customer, email: destino },
    });

    res.json({
      ok: resultado.enviado || resultado.estado === 'SIMULADO',
      estado: resultado.estado,
      mensaje:
        resultado.estado === 'ENVIADO'
          ? `Te lo mandamos a ${destino}.`
          : resultado.estado === 'SIMULADO'
            ? 'El envío de emails todavía no está configurado en este entorno. El comprobante quedó registrado.'
            : esRestriccionDeModoPrueba(resultado.error)
              ? 'El envío de emails está en modo de prueba: por ahora solo llega a la casilla de la cuenta de Resend. Guardá el comprobante desde esta pantalla.'
              : 'No pudimos enviar el email. Probá de nuevo o guardá el comprobante desde esta pantalla.',
    });
  }),
);

export default router;
