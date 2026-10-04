/**
 * Detalle de una reserva en el panel.
 */
import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Icono } from '../../components/ui/Iconos.jsx';
import { Cargando, ErrorCarga, Vacio } from '../../components/ui/Estado.jsx';
import { EstadoReserva, Aviso } from '../../components/ui/Varios.jsx';
import ModalWhatsApp from '../../components/admin/ModalWhatsApp.jsx';
import ModalEliminarReserva, { sePuedeEliminar } from '../../components/admin/ModalEliminarReserva.jsx';
import CorregirVehiculo, { puedeCorregirVehiculo } from '../../components/admin/CorregirVehiculo.jsx';
import { accionesDisponibles } from '../../components/admin/TablaReservas.jsx';
import { admin } from '../../services/spotnear.service.js';
import { usePedido, useTitulo } from '../../hooks/index.js';
import { useAccionesReserva } from '../../hooks/useAccionesReserva.js';
import {
  precio as fmtPrecio,
  patente as fmtPatente,
  telefono as fmtTelefono,
  fechaHora,
  fechaLarga,
  hora,
  duracion,
  vehiculo as fmtVehiculo,
} from '../../utils/formato.js';
import textos from '../../i18n/textos.js';
import './DetalleReserva.css';

const ACCION_CFG = {
  'check-in': { texto: textos.admin.reservas.acciones.checkIn, icono: 'llegada', clase: 'primario' },
  'check-out': { texto: textos.admin.reservas.acciones.checkOut, icono: 'salida', clase: 'oscuro' },
  cancelar: { texto: textos.admin.reservas.acciones.cancelar, icono: 'equis', clase: 'peligro' },
  'no-show': { texto: textos.admin.reservas.acciones.noShow, icono: 'alerta', clase: 'secundario' },
};

function Dato({ etiqueta, children, mono = false }) {
  if (children === null || children === undefined || children === '') return null;
  return (
    <div className="sn-detalle-reserva__dato">
      <dt>{etiqueta}</dt>
      <dd className={mono ? 'sn-mono' : undefined}>{children}</dd>
    </div>
  );
}

export function DetalleReserva() {
  const { id } = useParams();
  const navegar = useNavigate();

  const { datos, cargando, error, recargar } = usePedido(
    ({ signal }) => admin.reservas.detalle(id, { signal }),
    [id],
  );

  const { procesando, ejecutar, whatsapp, abrirWhatsApp, cerrarWhatsApp } = useAccionesReserva({
    alActualizar: recargar,
  });

  const [guardandoNota, setGuardandoNota] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(false);

  const reserva = datos?.reserva;
  useTitulo(reserva ? `Reserva ${reserva.codigo}` : textos.admin.detalleReserva.titulo);

  // Pantalla de carga completa solo la primera vez: al recargar después de una
  // acción (check-in, corregir el vehículo) se queda lo que ya se ve.
  if (cargando && !datos) return <Cargando />;

  if (error) {
    return error.status === 404 ? (
      <Vacio
        icono="ticket"
        titulo="No encontramos esta reserva"
        texto="Puede haber sido eliminada o pertenecer a otro estacionamiento."
        accion={
          <Link to="/panel/reservas" className="sn-boton sn-boton--primario">
            {textos.admin.detalleReserva.volver}
          </Link>
        }
      />
    ) : (
      <ErrorCarga error={error} onReintentar={recargar} />
    );
  }

  if (!reserva) return null;

  const disponibles = accionesDisponibles(reserva.estado);

  const camposExtra = Object.entries(reserva.camposExtra ?? {});

  const cambiarPago = async (paymentStatus) => {
    setGuardandoNota(true);
    try {
      await admin.reservas.editar(reserva.id, { paymentStatus });
      recargar();
    } finally {
      setGuardandoNota(false);
    }
  };

  return (
    <>
      <header className="sn-panel__cabecera">
        <div>
          <button type="button" className="sn-detalle-reserva__volver" onClick={() => navegar(-1)}>
            <Icono nombre="flechaIzquierda" tam={15} />
            {textos.admin.detalleReserva.volver}
          </button>
          <div className="sn-detalle-reserva__titulo-fila">
            <h1 className="sn-panel__titulo sn-mono">{reserva.codigo}</h1>
            <EstadoReserva estado={reserva.estado} />
          </div>
          <p className="sn-panel__subtitulo">
            {textos.origenes[reserva.source]} · creada el {fechaHora(reserva.createdAt)}
          </p>
        </div>

        <div className="sn-panel__acciones">
          {disponibles.map((accion) => {
            const cfg = ACCION_CFG[accion];
            return (
              <button
                key={accion}
                type="button"
                className={`sn-boton sn-boton--${cfg.clase}`}
                onClick={() => ejecutar(reserva, accion)}
                disabled={procesando === reserva.id}
              >
                <Icono nombre={cfg.icono} tam={17} />
                {cfg.texto}
              </button>
            );
          })}

          {/* Separada del resto: las demás acciones mueven la reserva de
              estado, esta la quita del panel. Solo con la reserva terminada. */}
          {sePuedeEliminar(reserva) && (
            <button
              type="button"
              className="sn-boton sn-boton--fantasma sn-boton--peligroso"
              onClick={() => setModalEliminar(true)}
              disabled={procesando === reserva.id}
            >
              <Icono nombre="basura" tam={17} />
              {textos.admin.reservas.eliminar}
            </button>
          )}
        </div>
      </header>

      {reserva.estado === 'CANCELADA' && (
        <Aviso tipo="error">
          Reserva cancelada{reserva.canceledAt ? ` el ${fechaHora(reserva.canceledAt)}` : ''}.
          {reserva.motivoCancelacion && ` Motivo: ${reserva.motivoCancelacion}`}
        </Aviso>
      )}

      <div className="sn-detalle-reserva__grilla">
        {/* ── Columna principal ── */}
        <div className="sn-detalle-reserva__columna">
          <section className="sn-panel__seccion">
            <div className="sn-panel__seccion-cabecera">
              <h2 className="sn-panel__seccion-titulo">{textos.admin.detalleReserva.periodo}</h2>
            </div>
            <div className="sn-panel__seccion-cuerpo">
              <div className="sn-detalle-reserva__periodo">
                <div className="sn-detalle-reserva__hito">
                  <span className="sn-detalle-reserva__hito-etiqueta">
                    <Icono nombre="llegada" tam={15} />
                    {textos.comprobante.ingreso}
                  </span>
                  <strong>{hora(reserva.inicio)}</strong>
                  <small>{fechaLarga(reserva.inicio)}</small>
                  {reserva.checkInAt && (
                    <span className="sn-detalle-reserva__real">
                      Ingresó {hora(reserva.checkInAt)}
                    </span>
                  )}
                </div>

                <span className="sn-detalle-reserva__duracion">
                  {duracion(reserva.inicio, reserva.fin)}
                </span>

                <div className="sn-detalle-reserva__hito">
                  <span className="sn-detalle-reserva__hito-etiqueta">
                    <Icono nombre="salida" tam={15} />
                    {textos.comprobante.salida}
                  </span>
                  <strong>{hora(reserva.fin)}</strong>
                  <small>{fechaLarga(reserva.fin)}</small>
                  {reserva.checkOutAt && (
                    <span className="sn-detalle-reserva__real">
                      Salió {hora(reserva.checkOutAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="sn-panel__seccion">
            <div className="sn-panel__seccion-cabecera">
              <h2 className="sn-panel__seccion-titulo">{textos.admin.detalleReserva.datosCliente}</h2>
            </div>
            <div className="sn-panel__seccion-cuerpo">
              <dl className="sn-detalle-reserva__datos">
                <Dato etiqueta={textos.checkout.nombre}>
                  {reserva.cliente.nombre} {reserva.cliente.apellido}
                </Dato>
                <Dato etiqueta={textos.checkout.telefono}>
                  <a href={`tel:${reserva.cliente.telefono}`} className="sn-link">
                    {fmtTelefono(reserva.cliente.telefono)}
                  </a>
                </Dato>
                <Dato etiqueta={textos.checkout.email}>
                  {reserva.cliente.email ? (
                    <a href={`mailto:${reserva.cliente.email}`} className="sn-link">
                      {reserva.cliente.email}
                    </a>
                  ) : null}
                </Dato>
              </dl>
            </div>
          </section>

          <section className="sn-panel__seccion">
            <div className="sn-panel__seccion-cabecera">
              <h2 className="sn-panel__seccion-titulo">{textos.admin.detalleReserva.datosVehiculo}</h2>
            </div>
            <div className="sn-panel__seccion-cuerpo">
              <dl className="sn-detalle-reserva__datos">
                <Dato etiqueta={textos.comprobante.patente} mono>
                  {fmtPatente(reserva.vehiculo.patente)}
                </Dato>
                <Dato etiqueta={textos.checkout.tipoVehiculo}>
                  {textos.parking.tiposVehiculo[reserva.vehiculo.tipo]}
                </Dato>
                <Dato etiqueta="Marca y modelo">{fmtVehiculo(reserva.vehiculo)}</Dato>
                <Dato etiqueta={textos.checkout.color}>{reserva.vehiculo.color}</Dato>
                {reserva.cantidadVehiculos > 1 && (
                  <Dato etiqueta={textos.checkout.cantidadVehiculos}>
                    {reserva.cantidadVehiculos}
                  </Dato>
                )}
              </dl>

              {/* En la entrada el playero ve el vehículo: si no es el tipo
                  cargado, lo corrige y se ajusta lo que se cobra en el lugar. */}
              {puedeCorregirVehiculo(reserva) && (
                <CorregirVehiculo reserva={reserva} alCorregir={recargar} />
              )}
            </div>
          </section>

          {(reserva.notas || camposExtra.length > 0) && (
            <section className="sn-panel__seccion">
              <div className="sn-panel__seccion-cabecera">
                <h2 className="sn-panel__seccion-titulo">
                  {textos.admin.detalleReserva.camposExtra}
                </h2>
              </div>
              <div className="sn-panel__seccion-cuerpo">
                <dl className="sn-detalle-reserva__datos">
                  {camposExtra.map(([clave, valor]) => (
                    <Dato key={clave} etiqueta={clave.replace(/_/g, ' ')}>
                      {String(valor)}
                    </Dato>
                  ))}
                  <Dato etiqueta={textos.comprobante.notas}>{reserva.notas}</Dato>
                </dl>
              </div>
            </section>
          )}
        </div>

        {/* ── Columna lateral ── */}
        <aside className="sn-detalle-reserva__lateral">
          <section className="sn-panel__seccion">
            <div className="sn-panel__seccion-cabecera">
              <h2 className="sn-panel__seccion-titulo">{textos.admin.detalleReserva.dinero}</h2>
            </div>
            <div className="sn-panel__seccion-cuerpo">
              <div className="sn-detalle-reserva__dinero">
                {/* La seña NO se descuenta de lo que cobra el estacionamiento:
                    se le suma. El dueño cobra su tarifa entera, en el lugar. */}
                <div className="sn-detalle-reserva__linea sn-detalle-reserva__linea--neto">
                  <span>{textos.admin.detalleReserva.neto}</span>
                  <strong>{fmtPrecio(reserva.montoNeto)}</strong>
                </div>

                <div className="sn-detalle-reserva__linea">
                  <span>
                    {textos.admin.detalleReserva.senaCobrada} ({reserva.comisionPorcentaje}%)
                  </span>
                  <span>+{fmtPrecio(reserva.montoComision)}</span>
                </div>

                <div className="sn-detalle-reserva__linea sn-detalle-reserva__linea--fuerte">
                  <span>{textos.admin.detalleReserva.precioTotal}</span>
                  <strong>{fmtPrecio(reserva.precioTotal)}</strong>
                </div>

                {reserva.desglosePrecio && (
                  <p className="sn-detalle-reserva__desglose">
                    {reserva.desglosePrecio.etiqueta}
                    {reserva.desglosePrecio.precioUnitario > 0 &&
                      ` · ${fmtPrecio(reserva.desglosePrecio.precioUnitario)} c/u`}
                  </p>
                )}

                <label className="sn-detalle-reserva__pago">
                  <span>Estado del pago</span>
                  <select
                    className="sn-select"
                    value={reserva.paymentStatus}
                    onChange={(e) => cambiarPago(e.target.value)}
                    // Sin la seña acreditada, el pago lo confirma Mercado Pago
                    // (el backend también lo rechaza).
                    disabled={guardandoNota || reserva.estado === 'PENDIENTE'}
                    title={reserva.estado === 'PENDIENTE' ? textos.admin.reservas.pagoLoConfirmaMP : undefined}
                  >
                    <option value="PENDIENTE">Pago pendiente</option>
                    <option value="PAGADO">Pagado</option>
                    <option value="FALLIDO">Pago rechazado</option>
                    <option value="REEMBOLSADO">Reembolsado</option>
                  </select>
                </label>
              </div>
            </div>
          </section>

          <section className="sn-panel__seccion">
            <div className="sn-panel__seccion-cuerpo sn-detalle-reserva__compartir">
              <button
                type="button"
                className="sn-boton sn-boton--whatsapp sn-boton--bloque"
                onClick={() => abrirWhatsApp(reserva, 'grupo')}
              >
                <Icono nombre="whatsapp" tam={17} />
                {textos.admin.detalleReserva.compartirGrupo}
              </button>

              <button
                type="button"
                className="sn-boton sn-boton--secundario sn-boton--bloque"
                onClick={() => abrirWhatsApp(reserva, 'cliente')}
              >
                <Icono nombre="telefono" tam={17} />
                {textos.admin.detalleReserva.compartirCliente}
              </button>

              {datos.links?.comprobante && (
                <a
                  href={datos.links.comprobante}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sn-boton sn-boton--fantasma sn-boton--bloque"
                >
                  <Icono nombre="qr" tam={17} />
                  {textos.admin.detalleReserva.verComprobante}
                  <Icono nombre="externo" tam={13} />
                </a>
              )}
            </div>
          </section>

          <section className="sn-panel__seccion">
            <div className="sn-panel__seccion-cabecera">
              <h2 className="sn-panel__seccion-titulo">
                {textos.admin.detalleReserva.notificaciones}
              </h2>
            </div>
            <div className="sn-panel__seccion-cuerpo">
              {datos.notificaciones?.length > 0 ? (
                <ul className="sn-detalle-reserva__envios">
                  {datos.notificaciones.map((n) => (
                    <li key={n.id}>
                      <Icono nombre={n.canal === 'EMAIL' ? 'mail' : 'whatsapp'} tam={15} />
                      <span className="sn-detalle-reserva__envio-destino">{n.destino}</span>
                      <span
                        className={`sn-badge sn-badge--${n.estado === 'ENVIADO' ? 'ok' : n.estado === 'FALLIDO' ? 'error' : 'neutro'}`}
                      >
                        {n.estado}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="sn-silencio">{textos.admin.detalleReserva.sinNotificaciones}</p>
              )}
            </div>
          </section>
        </aside>
      </div>

      <ModalEliminarReserva
        reserva={modalEliminar ? reserva : null}
        alCerrar={() => setModalEliminar(false)}
        alEliminar={() => navegar('/panel/reservas', { replace: true })}
      />

      <ModalWhatsApp
        abierto={whatsapp.abierto}
        alCerrar={cerrarWhatsApp}
        titulo={whatsapp.titulo}
        mensaje={whatsapp.mensaje}
        link={whatsapp.link}
        cargando={whatsapp.cargando}
      />
    </>
  );
}

export default DetalleReserva;
