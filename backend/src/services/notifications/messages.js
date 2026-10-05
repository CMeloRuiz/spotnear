/**
 * Armado de los mensajes de WhatsApp y email.
 *
 * Están todos acá juntos a propósito: el texto que ve el cliente es parte del
 * producto y se retoca seguido. Español rioplatense, voseo.
 */
import env from '../../config/env.js';
import { formatearARS } from '../../utils/money.js';
import { formatearPatente } from '../../utils/patente.js';
import { formatearTelefono } from '../../utils/phone.js';
import {
  formatearFechaLarga,
  formatearFechaCompleta,
  formatearHora,
  formatearFecha,
  minutosEntre,
} from '../../utils/dates.js';

/**
 * Azul de marca para los emails.
 *
 * Está duplicado acá a propósito: el HTML de un mail no puede leer las
 * variables CSS del frontend (muchos clientes de correo ni siquiera soportan
 * custom properties). Es el mismo valor que --sn-accion en
 * frontend/src/styles/variables.css; si cambia la marca, hay que tocar los dos.
 * Se usa el tono oscuro y no el del logo porque va de fondo con texto blanco
 * encima y tiene que llegar a 4.5:1 de contraste.
 */
const COLOR_MARCA = '#1177c5';

/** Link público y estable del comprobante. */
export function urlComprobante(reserva) {
  return `${env.PUBLIC_WEB_URL}/comprobante/${reserva.publicToken}`;
}

/**
 * Imagen PNG del comprobante, servida por la API.
 *
 * Es la que se manda por WhatsApp: el link `wa.me` no puede adjuntar archivos,
 * así que el mensaje lleva esta URL y el cliente abre el comprobante visual de
 * un toque. En modo cloud_api, Meta descarga esta misma URL y la adjunta como
 * imagen de verdad. Va contra la API y no contra la web porque tiene que ser un
 * archivo directo: WhatsApp no renderiza una SPA.
 */
export function urlComprobanteImagen(reserva) {
  return `${env.PUBLIC_API_URL}/api/v1/reservations/comprobante/${reserva.publicToken}/comprobante.png`;
}

/** Link de "Cómo llegar" en Google Maps. */
export function urlComoLlegar(parking) {
  if (parking.lat && parking.lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${parking.lat},${parking.lng}`;
  }
  const q = encodeURIComponent(`${parking.direccion}, ${parking.ciudad ?? 'CABA'}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** Descripción del vehículo: "Toyota Corolla — AB123CD" */
function describirVehiculo(vehiculo) {
  const marcaModelo = [vehiculo.marca, vehiculo.modelo].filter(Boolean).join(' ');
  const patente = formatearPatente(vehiculo.patente);
  return marcaModelo ? `${marcaModelo} — ${patente}` : patente;
}

/** "Sábado 25/10 — Ingreso 19:00 / Salida 00:30" */
function describirPeriodo(reserva) {
  const mismoDia = formatearFecha(reserva.inicio) === formatearFecha(reserva.fin);
  if (mismoDia) {
    return `${formatearFechaLarga(reserva.inicio)} — Ingreso ${formatearHora(reserva.inicio)} / Salida ${formatearHora(reserva.fin)}`;
  }
  return `Ingreso ${formatearFechaLarga(reserva.inicio)} ${formatearHora(reserva.inicio)} / Salida ${formatearFechaLarga(reserva.fin)} ${formatearHora(reserva.fin)}`;
}

/** "5 h 30 min", "2 días 4 h", "45 min". Sin ceros al pedo. */
function duracionLegible(inicio, fin) {
  const total = Math.max(0, Math.round(minutosEntre(inicio, fin)));
  const dias = Math.floor(total / 1440);
  const horas = Math.floor((total % 1440) / 60);
  const minutos = total % 60;

  const partes = [];
  if (dias > 0) partes.push(`${dias} día${dias === 1 ? '' : 's'}`);
  if (horas > 0) partes.push(`${horas} h`);
  if (minutos > 0) partes.push(`${minutos} min`);
  return partes.join(' ') || '0 min';
}

/** "Humboldt 450, Villa Crespo" */
function direccionCompleta(parking) {
  return `${parking.direccion}${parking.barrio ? `, ${parking.barrio}` : ''}`;
}

/**
 * Bloque de fechas del mensaje al cliente.
 * Si entra y sale el mismo día alcanza con una línea; si cruza la medianoche
 * (el caso típico de un recital) se separan ingreso y salida, porque ahí es
 * donde la gente se confunde de día.
 */
function bloqueCuando(reserva) {
  const duracion = duracionLegible(reserva.inicio, reserva.fin);
  const mismoDia = formatearFecha(reserva.inicio) === formatearFecha(reserva.fin);

  if (mismoDia) {
    return [
      `🗓️ *${formatearFechaCompleta(reserva.inicio)}*`,
      `🕒 Ingreso ${formatearHora(reserva.inicio)} · Salida ${formatearHora(reserva.fin)} (${duracion})`,
    ];
  }

  return [
    `🗓️ *Ingresás:* ${formatearFechaCompleta(reserva.inicio)} a las ${formatearHora(reserva.inicio)}`,
    `🗓️ *Salís:* ${formatearFechaCompleta(reserva.fin)} a las ${formatearHora(reserva.fin)}`,
    `🕒 Duración: ${duracion}`,
  ];
}

const ETIQUETA_PAGO = {
  PENDIENTE: 'pago pendiente',
  PAGADO: 'pagado',
  FALLIDO: 'pago rechazado',
  REEMBOLSADO: 'reembolsado',
};

/**
 * Nombre del cliente tal como quedó guardado EN LA RESERVA.
 *
 * Nunca se lee de `reserva.customer` directo: ese contacto lo comparten todas
 * las reservas del mismo teléfono y puede haber cambiado después. Un mensaje o
 * un comprobante emitido tiene que decir siempre lo mismo.
 */
function nombreDelCliente(reserva) {
  const nombre = reserva.clienteNombre ?? reserva.customer?.nombre ?? '';
  const apellido = reserva.clienteApellido ?? reserva.customer?.apellido ?? '';
  return [nombre, apellido].filter(Boolean).join(' ');
}

/** Línea divisoria: WhatsApp no tiene separadores, así que se dibuja uno. */
const REGLA = '━━━━━━━━━━━━━━━';

/**
 * Mensaje que se le manda AL CLIENTE con su comprobante.
 *
 * Deliberadamente corto. Antes era un bloque largo con todos los datos sueltos
 * y una docena de emojis: en el celular eso se lee mal y se pierde lo único que
 * importa al llegar, que es el código y el QR.
 *
 * Ahora el peso lo lleva la IMAGEN del comprobante (urlComprobanteImagen): es
 * el mismo diseño que se ve en la web, con el QR adentro, y el cliente la
 * guarda en el carrete de un toque. El texto queda como pie de foto: el código
 * —por si abre el chat sin señal para cargar la imagen—, dónde es y cómo
 * llegar. El resto de los datos ya están en la imagen y no hace falta
 * repetirlos.
 *
 * En modo cloud_api este texto viaja como caption de la imagen adjunta; en modo
 * link, como texto del wa.me con la imagen enlazada.
 *
 * @param {object} reserva Con parking, customer y vehicle incluidos.
 */
export function mensajeClienteWhatsApp(reserva) {
  const { parking } = reserva;

  const lineas = [
    '✅ *¡Listo! Tu lugar está reservado*',
    '',
    `🎟️ Código: *${reserva.codigo}*`,
    `🅿️ ${parking.nombre} — ${direccionCompleta(parking)}`,
    `📅 ${describirPeriodo(reserva)}`,
    `💵 Seña pagada: *${formatearARS(reserva.montoComision)}* (no reembolsable)`,
    `💰 A pagar en el estacionamiento: *${formatearARS(reserva.montoNeto)}*`,
    '',
    '🧾 Tu comprobante con el QR:',
    urlComprobanteImagen(reserva),
    '',
    `🗺️ Cómo llegar: ${urlComoLlegar(parking)}`,
    '',
    '_Mostrá el QR al entrar. El resto lo abonás ahí mismo._',
  ];

  return lineas.join('\n');
}

/**
 * Pie de la imagen del comprobante cuando se manda por la API de WhatsApp.
 *
 * Corto a propósito: TODO lo demás —estacionamiento, horarios, cliente,
 * vehículo, montos y el QR— está en la imagen. Repetirlo en texto es lo que
 * hacía que el mensaje se viera largo y desordenado.
 */
export function pieComprobanteWhatsApp(reserva) {
  return `✅ ¡Reserva confirmada! Código *${reserva.codigo}*\nMostrá esta imagen al entrar al estacionamiento.`;
}

/**
 * Mensaje para el GRUPO DE WHATSAPP del estacionamiento.
 * Es el que reemplaza al "che, anotá esta reserva" de hoy.
 */
export function mensajeGrupoWhatsApp(reserva) {
  const { parking, customer, vehicle } = reserva;

  const lineas = [
    '🅿️ NUEVA RESERVA — SpotNear',
    `Código: ${reserva.codigo}`,
    `👤 ${nombreDelCliente(reserva)}`,
    `📞 ${formatearTelefono(customer.telefono)}`,
    `🚗 ${describirVehiculo(vehicle)}`,
    `📅 ${describirPeriodo(reserva)}`,
  ];

  if (reserva.cantidadVehiculos > 1) lineas.push(`🔢 Vehículos: ${reserva.cantidadVehiculos}`);

  lineas.push(
    // Lo primero que necesita saber el playero es cuánto tiene que cobrar
    // cuando llegue el cliente. La seña va después, como contexto.
    `💰 A COBRAR EN EL LUGAR: *${formatearARS(reserva.montoNeto)}*`,
    `🎫 Seña ya pagada online: ${formatearARS(reserva.montoComision)} (${ETIQUETA_PAGO[reserva.paymentStatus] ?? 'pendiente'})`,
  );

  if (reserva.notas) lineas.push(`📝 ${reserva.notas}`);
  if (parking?.nombre) lineas.push(`🏢 ${parking.nombre}`);

  return lineas.join('\n');
}

/**
 * Resumen de TODAS las reservas de un día para mandar al grupo de una sola vez.
 * @param {Array} reservas
 * @param {Date} fecha
 */
export function mensajeResumenDelDia(reservas, fecha = new Date(), nombreParking = '') {
  if (reservas.length === 0) {
    return `🅿️ SpotNear — ${nombreParking}\n${formatearFechaLarga(fecha)}\n\nNo hay reservas para hoy.`;
  }

  const activas = reservas.filter((r) => !['CANCELADA', 'NO_SHOW'].includes(r.estado));
  const total = activas.reduce((acc, r) => acc + Number(r.precioTotal), 0);
  const lugares = activas.reduce((acc, r) => acc + r.cantidadVehiculos, 0);

  const lineas = [
    `🅿️ RESERVAS DE HOY — SpotNear`,
    nombreParking ? `🏢 ${nombreParking}` : null,
    `📅 ${formatearFechaLarga(fecha)}`,
    `📊 ${activas.length} reserva${activas.length === 1 ? '' : 's'} · ${lugares} lugar${lugares === 1 ? '' : 'es'}`,
    '',
  ].filter(Boolean);

  const ordenadas = [...activas].sort((a, b) => new Date(a.inicio) - new Date(b.inicio));

  for (const r of ordenadas) {
    lineas.push(
      `${formatearHora(r.inicio)}–${formatearHora(r.fin)} · ${r.codigo}`,
      `   ${nombreDelCliente(r)} · ${formatearPatente(r.vehicle.patente)}`,
      `   ${formatearARS(r.precioTotal)}`,
      '',
    );
  }

  lineas.push(`💵 Total previsto: ${formatearARS(total)}`);
  return lineas.join('\n');
}

/**
 * Link wa.me listo para abrir.
 * @param {string} telefonoE164  Con o sin +; se limpian los no-dígitos.
 * @param {string} texto
 */
export function linkWhatsApp(telefonoE164, texto) {
  const numero = String(telefonoE164 ?? '').replace(/\D/g, '');
  const mensaje = encodeURIComponent(texto);
  // Sin número, wa.me abre el selector de contactos: sirve para "compartir en el grupo".
  return numero ? `https://wa.me/${numero}?text=${mensaje}` : `https://wa.me/?text=${mensaje}`;
}

/**
 * Cuerpo HTML del email de confirmación.
 * @param {object} reserva
 * @param {string} [qrDataUrl] PNG del QR en base64 (data:image/png;base64,...)
 */
/** content-id con el que la imagen del comprobante va embebida en el email. */
export const CID_COMPROBANTE = 'comprobante-spotnear';

/**
 * Email del comprobante.
 *
 * El cuerpo ES la imagen del comprobante —el mismo PNG que se ve en pantalla,
 * que se adjunta y que baja "Guardar imagen"—, embebida con `cid:`. Antes era
 * una tabla de texto con los datos y el QR como imagen `data:`, que Gmail
 * bloquea: el cliente recibía datos sueltos y no el comprobante. Abajo van los
 * dos botones (ver online y cómo llegar). Si el cliente de correo no muestra
 * imágenes embebidas, el mismo PNG sigue estando como adjunto.
 *
 * @param {object} reserva
 * @param {{ conImagen?: boolean }} [opciones]  false si no se pudo generar el PNG
 */
export function emailComprobanteHTML(reserva, { conImagen = true } = {}) {
  const { parking } = reserva;
  const link = urlComprobante(reserva);
  const comoLlegar = urlComoLlegar(parking);

  const imagen = conImagen
    ? `<img src="cid:${CID_COMPROBANTE}" alt="Comprobante de la reserva ${reserva.codigo}" width="520" style="display:block;width:100%;max-width:520px;height:auto;margin:0 auto;border-radius:12px;border:1px solid #e5e7eb;">`
    : `<div style="font-size:30px;font-weight:800;letter-spacing:2px;color:#0f172a;text-align:center;padding:24px 0;">${reserva.codigo}</div>`;

  return `<!doctype html>
<html lang="es-AR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#f3f4f6;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
    <tr>
      <td style="padding:24px 20px 8px;text-align:center;color:#0f172a;font-size:18px;font-weight:700;">
        Tu reserva ${reserva.codigo} está confirmada
      </td>
    </tr>
    <tr>
      <td style="padding:0 20px 8px;text-align:center;color:#6b7280;font-size:14px;line-height:1.5;">
        Este es tu comprobante. Mostralo al llegar al estacionamiento: también lo tenés adjunto.
      </td>
    </tr>
    <tr>
      <td style="padding:12px 20px;">${imagen}</td>
    </tr>
    <tr>
      <td style="padding:12px 20px 24px;">
        <a href="${link}" style="display:block;background:${COLOR_MARCA};color:#ffffff;text-decoration:none;text-align:center;padding:14px;border-radius:10px;font-weight:700;font-size:15px;">Ver mi comprobante</a>
        <a href="${comoLlegar}" style="display:block;margin-top:10px;background:#ffffff;color:#0f172a;text-decoration:none;text-align:center;padding:13px;border-radius:10px;font-weight:600;font-size:15px;border:1px solid #d1d5db;">Cómo llegar</a>
      </td>
    </tr>
    <tr>
      <td style="padding:0 20px 24px;color:#9ca3af;font-size:12px;line-height:1.6;text-align:center;">
        La seña no es reembolsable. El resto se paga en el estacionamiento.<br>
        SpotNear es un producto de ColdevIA.
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Versión en texto plano del email (para clientes que no renderizan HTML).
 * Reusa el mensaje de WhatsApp y le saca el formato propio de WhatsApp: los
 * asteriscos y guiones bajos, que fuera de la app se leen como basura.
 */
export function emailComprobanteTexto(reserva) {
  return mensajeClienteWhatsApp(reserva)
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1');
}

export function asuntoEmail(reserva) {
  return `Reserva ${reserva.codigo} confirmada · ${reserva.parking.nombre}`;
}

/* ═══════════════════ Alta de estacionamientos (dueños) ═══════════════════ */

/**
 * Envoltorio HTML compartido por los emails que le llegan al dueño.
 * Es la misma estructura del comprobante, sin el bloque de QR: cabecera
 * oscura con la marca, cuerpo y pie.
 */
function marcoEmail({ titulo, bajada, cuerpo, accion }) {
  return `<!doctype html>
<html lang="es-AR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#f3f4f6;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
    <tr>
      <td style="background:#0f172a;padding:24px;text-align:center;">
        <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-.4px;">
          <span style="color:${COLOR_MARCA};">●</span> SpotNear
        </div>
        <div style="color:#94a3b8;font-size:13px;margin-top:4px;">${bajada}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 24px 8px;">
        <h1 style="margin:0 0 12px;font-size:20px;color:#0f172a;">${titulo}</h1>
        ${cuerpo}
      </td>
    </tr>
    ${accion
      ? `<tr><td style="padding:8px 24px 24px;">
           <a href="${accion.url}" style="display:block;background:${COLOR_MARCA};color:#ffffff;text-decoration:none;text-align:center;padding:14px;border-radius:10px;font-weight:700;font-size:15px;">${accion.etiqueta}</a>
         </td></tr>`
      : ''}
    <tr>
      <td style="padding:0 24px 28px;color:#9ca3af;font-size:12px;line-height:1.6;text-align:center;">
        SpotNear es un producto de ColdevIA.
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Datos del estacionamiento en filas, para los emails de alta. */
function filasParking(parking) {
  const fila = (etiqueta, valor) =>
    valor
      ? `<tr>
           <td style="padding:8px 0;color:#6b7280;font-size:14px;width:42%;">${etiqueta}</td>
           <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">${valor}</td>
         </tr>`
      : '';

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;margin:16px 0;">
    ${fila('Estacionamiento', parking.nombre)}
    ${fila('Dirección', parking.direccion)}
    ${fila('Capacidad', `${parking.capacidadTotal} lugares`)}
    ${fila('Comisión', `${Number(parking.comisionPorcentaje)}% por reserva confirmada`)}
  </table>`;
}

/** Acuse de recibo: la solicitud entró y queda esperando revisión. */
export function emailSolicitudRecibida({ parking, owner }) {
  return {
    asunto: `Recibimos tu solicitud · ${parking.nombre}`,
    html: marcoEmail({
      bajada: 'Solicitud de alta recibida',
      titulo: `¡Gracias, ${owner.nombre.split(' ')[0]}!`,
      cuerpo: `
        <p style="margin:0;color:#334155;font-size:15px;line-height:1.6;">
          Recibimos la solicitud para sumar tu estacionamiento a SpotNear. La revisamos
          a mano y te respondemos en menos de 24 horas. Te escribimos a este mismo
          mail apenas esté lista.
        </p>
        ${filasParking(parking)}
        <p style="margin:0;color:#64748b;font-size:14px;line-height:1.6;">
          Mientras tanto no hace falta que hagas nada. Cuando la aprobemos vas a poder
          ingresar al panel con el email <strong>${owner.email}</strong> y la contraseña
          que elegiste.
        </p>`,
    }),
  };
}

/** Aprobada: ya puede entrar al panel. */
export function emailSolicitudAprobada({ parking, owner }) {
  return {
    asunto: `Tu estacionamiento ya está publicado · ${parking.nombre}`,
    html: marcoEmail({
      bajada: 'Solicitud aprobada',
      titulo: '¡Listo! Ya estás en SpotNear',
      cuerpo: `
        <p style="margin:0;color:#334155;font-size:15px;line-height:1.6;">
          Aprobamos la solicitud de <strong>${parking.nombre}</strong>. Ya aparece en las
          búsquedas y podés empezar a recibir reservas.
        </p>
        ${filasParking(parking)}
        <p style="margin:0;color:#334155;font-size:15px;line-height:1.6;">
          <strong>Lo primero que conviene hacer:</strong> cargá tus tarifas desde el panel.
          Sin al menos una tarifa por hora, el estacionamiento no puede cotizar y no
          aparece en los resultados.
        </p>
        <p style="margin:16px 0 0;color:#64748b;font-size:14px;line-height:1.6;">
          Ingresás con <strong>${owner.email}</strong> y la contraseña que elegiste al registrarte.
        </p>`,
      accion: { url: `${env.PUBLIC_WEB_URL}/panel/ingresar`, etiqueta: 'Entrar al panel' },
    }),
  };
}

/** Rechazada: se avisa con el motivo, si lo hay. */
export function emailSolicitudRechazada({ parking, owner, motivo }) {
  return {
    asunto: `Sobre tu solicitud · ${parking.nombre}`,
    html: marcoEmail({
      bajada: 'Solicitud revisada',
      titulo: 'No pudimos aprobar tu solicitud',
      cuerpo: `
        <p style="margin:0;color:#334155;font-size:15px;line-height:1.6;">
          Hola ${owner.nombre.split(' ')[0]}: revisamos la solicitud de
          <strong>${parking.nombre}</strong> y por ahora no pudimos aprobarla.
        </p>
        ${motivo
          ? `<p style="margin:16px 0;padding:14px 16px;background:#f8fafc;border-left:3px solid #cbd5e1;color:#334155;font-size:14px;line-height:1.6;">${motivo}</p>`
          : ''}
        <p style="margin:16px 0 0;color:#64748b;font-size:14px;line-height:1.6;">
          Si creés que hubo un error o querés corregir los datos, respondé este mail y lo
          vemos juntos. No borramos nada: la solicitud queda guardada.
        </p>`,
    }),
  };
}
