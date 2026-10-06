/**
 * Tabla de reservas del panel.
 *
 * En escritorio es una tabla; en el celular, tarjetas. No es solo estética:
 * el playero trabaja desde el teléfono y una tabla de 10 columnas ahí no se
 * puede usar.
 */
import { Link } from 'react-router-dom';
import { Icono } from '../ui/Iconos.jsx';
import { EstadoReserva } from '../ui/Varios.jsx';
import { sePuedeEliminar } from './ModalEliminarReserva.jsx';
import {
  precio as fmtPrecio,
  patente as fmtPatente,
  telefono as fmtTelefono,
  hora,
  fechaCorta,
  fechaRelativa,
  vehiculo as fmtVehiculo,
  nombreCompleto,
} from '../../utils/formato.js';
import textos from '../../i18n/textos.js';
import './TablaReservas.css';

/** Qué acciones tienen sentido según el estado actual. */
export function accionesDisponibles(estado) {
  switch (estado) {
    // Sin la seña acreditada solo se puede cancelar: el check-in lo bloquea
    // también el backend. Se confirma sola cuando entra el pago.
    case 'PENDIENTE':
      return ['cancelar'];
    case 'CONFIRMADA':
      return ['check-in', 'cancelar', 'no-show'];
    case 'EN_CURSO':
      return ['check-out'];
    default:
      return [];
  }
}

const ETIQUETA_ACCION = {
  'check-in': { texto: textos.admin.reservas.acciones.checkIn, icono: 'llegada', clase: 'primario' },
  'check-out': { texto: textos.admin.reservas.acciones.checkOut, icono: 'salida', clase: 'oscuro' },
  cancelar: { texto: textos.admin.reservas.acciones.cancelar, icono: 'equis', clase: 'peligro' },
  'no-show': { texto: textos.admin.reservas.acciones.noShow, icono: 'alerta', clase: 'fantasma' },
};

function Acciones({ reserva, onAccion, procesando, compacto = false }) {
  const disponibles = accionesDisponibles(reserva.estado);
  if (disponibles.length === 0) return null;
  // En la tabla, una reserva sin seña no lleva botón: "Cancelar" como acción
  // principal de la fila invitaría a tocarlo. Vive en el detalle.
  if (compacto && reserva.estado === 'PENDIENTE') return null;

  // En la tabla solo va la acción principal; el resto vive en el detalle.
  const mostrar = compacto ? disponibles.slice(0, 1) : disponibles;

  return (
    <div className="sn-tabla-reservas__acciones">
      {mostrar.map((accion) => {
        const cfg = ETIQUETA_ACCION[accion];
        return (
          <button
            key={accion}
            type="button"
            className={`sn-boton sn-boton--${cfg.clase} sn-boton--sm`}
            onClick={() => onAccion(reserva, accion)}
            disabled={procesando === reserva.id}
          >
            {procesando === reserva.id ? (
              <span className="sn-spinner" style={{ width: 14, height: 14 }} aria-hidden="true" />
            ) : (
              <Icono nombre={cfg.icono} tam={15} />
            )}
            {cfg.texto}
          </button>
        );
      })}
    </div>
  );
}

/**
 * @param {object} props
 * @param {Array} props.reservas
 * @param {(reserva, accion) => void} props.onAccion
 * @param {(reserva) => void} [props.onWhatsApp]
 * @param {(reserva) => void} [props.onEliminar] Quitar del panel (solo reservas terminadas)
 * @param {string|null} [props.procesando] Id de la reserva con una acción en curso
 * @param {boolean} [props.mostrarParking] Para el SUPERADMIN, que ve varios
 */
/**
 * El monto de una reserva según quién mira: el SUPERADMIN recibe el total
 * (con la seña); al estacionamiento la API no se lo manda y ve lo que cobra en
 * el lugar.
 */
const montoVisible = (r) => r.precioTotal ?? r.montoNeto;

export function TablaReservas({
  reservas = [],
  onAccion,
  onWhatsApp,
  onEliminar,
  procesando = null,
  mostrarParking = false,
}) {
  return (
    <>
      {/* ── Escritorio ── */}
      <div className="sn-tabla-scroll sn-tabla-reservas__escritorio">
        <table className="sn-tabla">
          <thead>
            <tr>
              <th>{textos.admin.reservas.columnas.codigo}</th>
              {mostrarParking && <th>Estacionamiento</th>}
              <th>{textos.admin.reservas.columnas.cliente}</th>
              <th>{textos.admin.reservas.columnas.vehiculo}</th>
              <th>{textos.admin.reservas.columnas.ingreso}</th>
              <th>{textos.admin.reservas.columnas.salida}</th>
              <th>{textos.admin.reservas.columnas.estado}</th>
              <th className="sn-tabla__num">
                {mostrarParking ? textos.admin.reservas.columnas.monto : textos.admin.comisiones.aCobrar}
              </th>
              <th aria-label={textos.admin.reservas.columnas.acciones} />
            </tr>
          </thead>
          <tbody>
            {reservas.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link to={`/panel/reservas/${r.id}`} className="sn-tabla-reservas__codigo">
                    {r.codigo}
                  </Link>
                </td>

                {mostrarParking && (
                  <td className="sn-tabla-reservas__parking">
                    {r.parking?.nombre ?? '—'}
                    {r.parking?.eliminado && (
                      <span className="sn-badge sn-badge--neutro sn-badge--contador">
                        {textos.admin.reservas.parkingEliminado}
                      </span>
                    )}
                  </td>
                )}

                <td>
                  <div className="sn-tabla-reservas__cliente">
                    <strong>{nombreCompleto(r.cliente)}</strong>
                    <a href={`tel:${r.cliente.telefono}`} className="sn-tabla-reservas__tel">
                      {fmtTelefono(r.cliente.telefono)}
                    </a>
                  </div>
                </td>

                <td>
                  <div className="sn-tabla-reservas__vehiculo">
                    <span className="sn-tabla-reservas__patente">
                      {fmtPatente(r.vehiculo.patente)}
                    </span>
                    <small>
                      {fmtVehiculo(r.vehiculo) || textos.parking.tiposVehiculo[r.vehiculo.tipo]}
                    </small>
                  </div>
                </td>

                <td>
                  {/* El flex va en un div: con display:flex en el <td> la celda deja
                      de ser celda y la tabla se descuadra. */}
                  <div className="sn-tabla-reservas__horario">
                    <strong>{hora(r.inicio)}</strong>
                    <small>{fechaCorta(r.inicio)}</small>
                  </div>
                </td>

                <td>
                  {/* El flex va en un div: con display:flex en el <td> la celda deja
                      de ser celda y la tabla se descuadra. */}
                  <div className="sn-tabla-reservas__horario">
                    <strong>{hora(r.fin)}</strong>
                    <small>{fechaCorta(r.fin)}</small>
                  </div>
                </td>

                <td>
                  <EstadoReserva estado={r.estado} />
                </td>

                <td className="sn-tabla__num sn-precio">{fmtPrecio(montoVisible(r))}</td>

                <td>
                  <div className="sn-tabla-reservas__fila-acciones">
                    <Acciones reserva={r} onAccion={onAccion} procesando={procesando} compacto />
                    {onWhatsApp && (
                      <button
                        type="button"
                        className="sn-tabla-reservas__icono"
                        onClick={() => onWhatsApp(r)}
                        title={textos.admin.detalleReserva.compartirGrupo}
                      >
                        <Icono nombre="whatsapp" tam={17} />
                        <span className="sn-solo-lectores">
                          {textos.admin.detalleReserva.compartirGrupo}
                        </span>
                      </button>
                    )}
                    {onEliminar && sePuedeEliminar(r) && (
                      <button
                        type="button"
                        className="sn-tabla-reservas__icono sn-tabla-reservas__icono--peligro"
                        onClick={() => onEliminar(r)}
                        title={textos.admin.reservas.eliminar}
                      >
                        <Icono nombre="basura" tam={17} />
                        <span className="sn-solo-lectores">{textos.admin.reservas.eliminar}</span>
                      </button>
                    )}
                    <Link
                      to={`/panel/reservas/${r.id}`}
                      className="sn-tabla-reservas__icono"
                      title={textos.admin.reservas.acciones.ver}
                    >
                      <Icono nombre="flechaDerecha" tam={17} />
                      <span className="sn-solo-lectores">{textos.admin.reservas.acciones.ver}</span>
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Celular ── */}
      <ul className="sn-tabla-reservas__movil">
        {reservas.map((r) => (
          <li key={r.id} className="sn-reserva-tarjeta">
            <div className="sn-reserva-tarjeta__cabecera">
              <Link to={`/panel/reservas/${r.id}`} className="sn-tabla-reservas__codigo">
                {r.codigo}
              </Link>
              <EstadoReserva estado={r.estado} />
            </div>

            <div className="sn-reserva-tarjeta__cuerpo">
              <p className="sn-reserva-tarjeta__nombre">{nombreCompleto(r.cliente)}</p>

              <p className="sn-reserva-tarjeta__linea">
                <Icono nombre="auto" tam={15} />
                <span className="sn-tabla-reservas__patente">{fmtPatente(r.vehiculo.patente)}</span>
                {fmtVehiculo(r.vehiculo) && <small>· {fmtVehiculo(r.vehiculo)}</small>}
              </p>

              <p className="sn-reserva-tarjeta__linea">
                <Icono nombre="reloj" tam={15} />
                {fechaRelativa(r.inicio)} – {hora(r.fin)}
              </p>

              {mostrarParking && r.parking && (
                <p className="sn-reserva-tarjeta__linea">
                  <Icono nombre="edificio" tam={15} />
                  {r.parking.nombre}
                </p>
              )}

              <p className="sn-reserva-tarjeta__monto">{fmtPrecio(montoVisible(r))}</p>
            </div>

            <div className="sn-reserva-tarjeta__pie">
              <a href={`tel:${r.cliente.telefono}`} className="sn-boton sn-boton--fantasma sn-boton--sm">
                <Icono nombre="telefono" tam={15} />
                Llamar
              </a>
              {onWhatsApp && (
                <button
                  type="button"
                  className="sn-boton sn-boton--fantasma sn-boton--sm"
                  onClick={() => onWhatsApp(r)}
                >
                  <Icono nombre="whatsapp" tam={15} />
                  Compartir
                </button>
              )}
              <Acciones reserva={r} onAccion={onAccion} procesando={procesando} compacto />
              {onEliminar && sePuedeEliminar(r) && (
                <button
                  type="button"
                  className="sn-boton sn-boton--fantasma sn-boton--sm"
                  onClick={() => onEliminar(r)}
                >
                  <Icono nombre="basura" tam={15} />
                  {textos.admin.reservas.eliminarCorto}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

export default TablaReservas;
