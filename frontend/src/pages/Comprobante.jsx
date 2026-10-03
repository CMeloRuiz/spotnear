/**
 * Comprobante de la reserva.
 *
 * Es la pantalla que el cliente le muestra al playero, así que tiene que
 * funcionar bien en un celular, verse en el sol y poder guardarse de varias
 * formas: WhatsApp, email, PDF, imagen o link.
 */
import { useState } from 'react';
import { useParams, useLocation, Link, Navigate } from 'react-router-dom';
import { Icono } from '../components/ui/Iconos.jsx';
import { Cargando, ErrorCarga, Vacio } from '../components/ui/Estado.jsx';
import { Modal, Aviso, EstadoReserva } from '../components/ui/Varios.jsx';
import { Campo } from '../components/ui/Campo.jsx';
import { publico } from '../services/spotnear.service.js';
import { usePedido, useTitulo, useCopiar } from '../hooks/index.js';
import { useToast } from '../context/ToastContext.jsx';
import { descargarImagenComprobante } from '../utils/comprobanteImagen.js';
import { esEmailValido } from '../utils/validaciones.js';
import {
  precio as fmtPrecio,
  fechaLarga,
  hora,
  duracion,
  patente as fmtPatente,
  telefono as fmtTelefono,
} from '../utils/formato.js';
import textos from '../i18n/textos.js';
import './Comprobante.css';

export function Comprobante() {
  const { token } = useParams();
  const ubicacion = useLocation();
  const toast = useToast();
  const { copiar } = useCopiar();

  // Si venimos del checkout, el comprobante ya está en el state de navegación:
  // no hace falta pedirlo de nuevo y la pantalla aparece al instante.
  const precargado = ubicacion.state?.comprobante ?? null;
  const recienCreada = ubicacion.state?.recienCreada ?? false;

  const [modalEmail, setModalEmail] = useState(false);
  const [emailDestino, setEmailDestino] = useState('');
  const [errorEmail, setErrorEmail] = useState(null);
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [generandoImagen, setGenerandoImagen] = useState(false);
  const [enviandoWhatsApp, setEnviandoWhatsApp] = useState(false);

  const { datos, cargando, error, recargar } = usePedido(
    ({ signal }) => publico.comprobante(token, { signal }),
    [token],
    { inmediato: !precargado },
  );

  const comprobante = precargado ?? datos;

  useTitulo(comprobante ? `Reserva ${comprobante.reserva.codigo}` : 'Comprobante');

  if (!precargado && cargando) return <Cargando texto="Buscando tu comprobante..." />;

  if (!comprobante) {
    return (
      <div className="sn-contenedor sn-seccion">
        {error?.status === 404 ? (
          <Vacio
            icono="ticket"
            titulo={textos.comprobante.noEncontrado}
            texto={textos.comprobante.noEncontradoTexto}
            accion={
              <Link to="/" className="sn-boton sn-boton--primario">
                {textos.comprobante.volverAlInicio}
              </Link>
            }
          />
        ) : (
          <ErrorCarga error={error} onReintentar={recargar} />
        )}
      </div>
    );
  }

  const { reserva, qr, links } = comprobante;

  // Sin la seña acreditada no hay comprobante que mostrar: no hay QR ni links,
  // porque el backend no los emite hasta que el pago esté aprobado. Ese estado
  // lo maneja la pantalla de pago, que es la que sabe esperar y reintentar.
  if (reserva.pago?.esperandoLaSena) return <Navigate to={`/pago/${token}`} replace />;

  const cancelada = reserva.estado === 'CANCELADA';

  /* ── Acciones ── */

  /**
   * Manda la IMAGEN del comprobante al WhatsApp del cliente, por la API de
   * WhatsApp del backend. No abre wa.me: ese link solo arma texto, no puede
   * adjuntar la imagen. Si el envío no está configurado, el backend lo dice.
   */
  const enviarPorWhatsApp = async () => {
    setEnviandoWhatsApp(true);
    try {
      const r = await publico.enviarComprobantePorWhatsApp(token);
      if (r.ok) toast.ok(r.mensaje);
      else if (r.estado === 'NO_CONFIGURADO') toast.info(r.mensaje);
      else toast.error(r.mensaje);
    } catch (e) {
      toast.error(e.message ?? textos.errores.generico);
    } finally {
      setEnviandoWhatsApp(false);
    }
  };

  const enviarPorEmail = async () => {
    const destino = emailDestino.trim() || reserva.cliente.email;

    if (!destino || !esEmailValido(destino)) {
      setErrorEmail(textos.errores.emailInvalido);
      return;
    }

    setEnviandoEmail(true);
    setErrorEmail(null);

    try {
      const r = await publico.enviarComprobantePorEmail(token, destino);
      setModalEmail(false);
      setEmailDestino('');
      // El backend avisa si el envío quedó simulado por falta de SMTP.
      if (r.estado === 'ENVIADO') toast.ok(r.mensaje);
      else toast.info(r.mensaje);
    } catch (e) {
      setErrorEmail(e.message);
    } finally {
      setEnviandoEmail(false);
    }
  };

  const guardarImagen = async () => {
    setGenerandoImagen(true);
    try {
      await descargarImagenComprobante(reserva, qr);
      toast.ok('Imagen guardada');
    } catch {
      toast.error('No pudimos generar la imagen. Probá con "Descargar PDF".');
    } finally {
      setGenerandoImagen(false);
    }
  };

  const copiarLink = async () => {
    const ok = await copiar(links.comprobante);
    if (ok) toast.ok(textos.comprobante.linkCopiado);
    else toast.error('No pudimos copiar el link.');
  };

  const compartirNativo = async () => {
    // En el celular, el menú nativo de compartir es lo más cómodo.
    if (!navigator.share) {
      copiarLink();
      return;
    }
    try {
      await navigator.share({
        title: `Reserva ${reserva.codigo} · SpotNear`,
        text: `Mi reserva en ${reserva.parking.nombre}`,
        url: links.comprobante,
      });
    } catch {
      /* el usuario canceló: no hay nada que informar */
    }
  };

  return (
    <div className="sn-comprobante">
      <div className="sn-contenedor sn-comprobante__contenedor">
        {recienCreada && !cancelada && (
          <header className="sn-comprobante__exito sn-no-imprimir">
            <span className="sn-comprobante__exito-icono">
              <Icono nombre="checkCirculo" tam={30} />
            </span>
            <div>
              <h1 className="sn-comprobante__exito-titulo">{textos.comprobante.titulo}</h1>
              <p className="sn-comprobante__exito-texto">{textos.comprobante.subtitulo}</p>
            </div>
          </header>
        )}

        {cancelada && (
          <Aviso tipo="error" className="sn-no-imprimir">
            {textos.comprobante.cancelada}
            {reserva.motivoCancelacion && ` ${reserva.motivoCancelacion}`}
          </Aviso>
        )}

        {/* ═══════════ Ticket ═══════════ */}
        <article className={`sn-ticket ${cancelada ? 'sn-ticket--cancelada' : ''}`}>
          <header className="sn-ticket__cabecera">
            <div className="sn-ticket__marca">
              <img src="/assets/logo_spotnear.png" alt="SpotNear" height={26} />
            </div>
            <EstadoReserva estado={reserva.estado} />
          </header>

          <div className="sn-ticket__codigo">
            <span className="sn-ticket__codigo-etiqueta">{textos.comprobante.codigoReserva}</span>
            <strong className="sn-ticket__codigo-valor">{reserva.codigo}</strong>

            {qr && (
              <img
                src={qr}
                alt={`Código QR de la reserva ${reserva.codigo}`}
                className="sn-ticket__qr"
                width={180}
                height={180}
              />
            )}

            <p className="sn-ticket__instruccion">{textos.comprobante.presenta}</p>
          </div>

          <div className="sn-ticket__corte" aria-hidden="true">
            <span className="sn-ticket__muesca sn-ticket__muesca--izq" />
            <span className="sn-ticket__linea" />
            <span className="sn-ticket__muesca sn-ticket__muesca--der" />
          </div>

          <dl className="sn-ticket__detalle">
            <div>
              <dt>{textos.comprobante.estacionamiento}</dt>
              <dd>{reserva.parking.nombre}</dd>
            </div>
            <div>
              <dt>{textos.comprobante.direccion}</dt>
              <dd>
                {reserva.parking.direccion}
                {reserva.parking.barrio && `, ${reserva.parking.barrio}`}
              </dd>
            </div>
            <div>
              <dt>{textos.comprobante.ingreso}</dt>
              <dd>
                {fechaLarga(reserva.inicio)} · {hora(reserva.inicio)}
              </dd>
            </div>
            <div>
              <dt>{textos.comprobante.salida}</dt>
              <dd>
                {fechaLarga(reserva.fin)} · {hora(reserva.fin)}
                <span className="sn-ticket__duracion"> ({duracion(reserva.inicio, reserva.fin)})</span>
              </dd>
            </div>
            <div>
              <dt>{textos.comprobante.aNombreDe}</dt>
              <dd>
                {reserva.cliente.nombre} {reserva.cliente.apellido}
              </dd>
            </div>
            <div>
              <dt>{textos.comprobante.telefono}</dt>
              <dd>{fmtTelefono(reserva.cliente.telefono)}</dd>
            </div>
            <div>
              <dt>{textos.comprobante.vehiculo}</dt>
              <dd>
                {[reserva.vehiculo.marca, reserva.vehiculo.modelo].filter(Boolean).join(' ') ||
                  textos.parking.tiposVehiculo[reserva.vehiculo.tipo]}
                {reserva.vehiculo.color && ` · ${reserva.vehiculo.color}`}
              </dd>
            </div>
            <div>
              <dt>{textos.comprobante.patente}</dt>
              <dd className="sn-ticket__patente">{fmtPatente(reserva.vehiculo.patente)}</dd>
            </div>
            {reserva.cantidadVehiculos > 1 && (
              <div>
                <dt>{textos.checkout.cantidadVehiculos}</dt>
                <dd>{reserva.cantidadVehiculos}</dd>
              </div>
            )}
            {reserva.notas && (
              <div>
                <dt>{textos.comprobante.notas}</dt>
                <dd>{reserva.notas}</dd>
              </div>
            )}
            <div>
              <dt>{textos.comprobante.enElEstacionamiento}</dt>
              <dd>
                <strong>{fmtPrecio(reserva.aPagarEnElLugar ?? reserva.subtotal)}</strong>
              </dd>
            </div>
            <div>
              <dt>{textos.comprobante.sena}</dt>
              <dd>
                {fmtPrecio(reserva.sena ?? 0)}
                <span className="sn-ticket__pago">
                  {reserva.paymentStatus === 'PAGADO'
                    ? textos.comprobante.pagado
                    : textos.comprobante.pagoPendiente}
                </span>
              </dd>
            </div>
            <div className="sn-ticket__total">
              <dt>{textos.comprobante.total}</dt>
              <dd>{fmtPrecio(reserva.precioTotal)}</dd>
            </div>
          </dl>

          <p className="sn-ticket__aclaracion">{textos.comprobante.aclaracionSena}</p>
        </article>

        {/* ═══════════ Acciones ═══════════ */}
        <div className="sn-comprobante__acciones sn-no-imprimir">
          <button
            type="button"
            onClick={enviarPorWhatsApp}
            disabled={enviandoWhatsApp}
            className="sn-boton sn-boton--whatsapp sn-boton--lg sn-boton--bloque"
          >
            {enviandoWhatsApp ? (
              <span className="sn-spinner" style={{ width: 18, height: 18 }} aria-hidden="true" />
            ) : (
              <Icono nombre="whatsapp" tam={19} />
            )}
            {enviandoWhatsApp ? textos.comprobante.enviando : textos.comprobante.enviarWhatsApp}
          </button>

          <a
            href={links.comoLlegar}
            target="_blank"
            rel="noopener noreferrer"
            className="sn-boton sn-boton--oscuro sn-boton--lg sn-boton--bloque"
          >
            <Icono nombre="llegada" tam={18} />
            {textos.comprobante.comoLlegar}
          </a>

          <div className="sn-comprobante__secundarias">
            <button
              type="button"
              className="sn-boton sn-boton--secundario"
              onClick={() => {
                setEmailDestino(reserva.cliente.email ?? '');
                setModalEmail(true);
              }}
            >
              <Icono nombre="mail" tam={17} />
              {textos.comprobante.enviarEmail}
            </button>

            {/* "Descargar PDF" abre el diálogo de impresión: todos los
                navegadores ofrecen ahí "Guardar como PDF". */}
            <button type="button" className="sn-boton sn-boton--secundario" onClick={() => window.print()}>
              <Icono nombre="descargar" tam={17} />
              {textos.comprobante.descargarPDF}
            </button>

            <button
              type="button"
              className="sn-boton sn-boton--secundario"
              onClick={guardarImagen}
              disabled={generandoImagen}
            >
              {generandoImagen ? (
                <span className="sn-spinner" style={{ width: 16, height: 16 }} aria-hidden="true" />
              ) : (
                <Icono nombre="imagen" tam={17} />
              )}
              {textos.comprobante.guardarImagen}
            </button>

            <button type="button" className="sn-boton sn-boton--secundario" onClick={compartirNativo}>
              <Icono nombre="compartir" tam={17} />
              {textos.comprobante.compartir}
            </button>

            <button type="button" className="sn-boton sn-boton--secundario" onClick={copiarLink}>
              <Icono nombre="copiar" tam={17} />
              {textos.comprobante.copiarLink}
            </button>
          </div>

          <Link to="/" className="sn-comprobante__volver">
            <Icono nombre="flechaIzquierda" tam={15} />
            {textos.comprobante.volverAlInicio}
          </Link>
        </div>
      </div>

      {/* ═══════════ Modal de email ═══════════ */}
      <Modal
        abierto={modalEmail}
        alCerrar={() => setModalEmail(false)}
        titulo={textos.comprobante.enviarEmail}
        ancho={440}
        pie={
          <>
            <button
              type="button"
              className="sn-boton sn-boton--fantasma"
              onClick={() => setModalEmail(false)}
              disabled={enviandoEmail}
            >
              {textos.comunes.cancelar}
            </button>
            <button
              type="button"
              className="sn-boton sn-boton--primario"
              onClick={enviarPorEmail}
              disabled={enviandoEmail}
            >
              {enviandoEmail ? textos.comprobante.enviando : textos.comprobante.enviar}
            </button>
          </>
        }
      >
        <Campo
          type="email"
          label={textos.comprobante.emailPedirDireccion}
          placeholder="tucorreo@ejemplo.com"
          value={emailDestino}
          onChange={(e) => {
            setEmailDestino(e.target.value);
            setErrorEmail(null);
          }}
          error={errorEmail}
          autoComplete="email"
        />
      </Modal>
    </div>
  );
}

export default Comprobante;
