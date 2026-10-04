/**
 * Tarjeta de un estacionamiento en el listado de resultados.
 *
 * No lleva a ninguna vista de detalle: de la tarjeta se reserva y punto. La
 * pantalla de detalle sigue existiendo (/estacionamiento/:slug) y se usa desde
 * el checkout para cambiar el horario, pero desde los resultados se sacó a
 * pedido: un paso intermedio que nadie necesitaba para elegir.
 *
 * El tag "Cubierto" y los servicios se dibujan SOLO con lo que cada
 * estacionamiento tiene configurado en su panel. Nada acá inventa un valor por
 * defecto: si el dueño no marcó "Es cubierto", el tag no aparece.
 */
import { Icono, ICONO_SERVICIO } from '../ui/Iconos.jsx';
import { Estrellas } from '../ui/Varios.jsx';
import { precio as fmtPrecio, distancia as fmtDistancia } from '../../utils/formato.js';
import { leyendaHorario } from '../../utils/horarios.js';
import textos from '../../i18n/textos.js';
import './TarjetaParking.css';

const FOTO_POR_DEFECTO = '/assets/parkings/sin-foto.svg';

/**
 * @param {object} props
 * @param {object} props.resultado
 * @param {boolean} props.mostrarTotal    Total de la estadía vs. precio por hora
 * @param {boolean} props.resaltado       Está señalado desde el mapa
 * @param {(id: string|null) => void} props.onResaltar
 * @param {() => void} props.onReservar
 * @param {Date} [props.fecha]            Ingreso buscado: el horario que se muestra es el de ese día
 */
export function TarjetaParking({
  resultado,
  mostrarTotal = true,
  resaltado = false,
  seleccionado = false,
  onResaltar,
  onReservar,
  innerRef,
  fecha,
}) {
  const {
    nombre,
    direccion,
    barrio,
    foto,
    calificacion,
    cantidadResenas,
    distanciaMetros,
    minutosCaminando,
    precio,
    precioDesde,
    disponibilidad,
    servicios = [],
    cubierto,
    etiquetas = [],
  } = resultado;

  const sinLugar = !disponibilidad?.hayLugar;
  const horario = leyendaHorario(resultado, fecha);
  const pocosLugares = disponibilidad?.libres > 0 && disponibilidad.libres <= 5;

  return (
    <article
      ref={innerRef}
      className={[
        'sn-tarjeta-parking',
        resaltado ? 'sn-tarjeta-parking--resaltada' : '',
        seleccionado ? 'sn-tarjeta-parking--seleccionada' : '',
        sinLugar ? 'sn-tarjeta-parking--sin-lugar' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onMouseEnter={() => onResaltar?.(resultado.id)}
      onMouseLeave={() => onResaltar?.(null)}
    >
      {etiquetas.length > 0 && (
        <div className="sn-tarjeta-parking__etiquetas">
          {etiquetas.map((e) => (
            <span key={e} className="sn-etiqueta">
              {textos.resultados.etiquetas[e] ?? e}
            </span>
          ))}
        </div>
      )}

      <div className="sn-tarjeta-parking__cuerpo">
        <div className="sn-tarjeta-parking__foto">
          <img
            src={foto || FOTO_POR_DEFECTO}
            alt=""
            loading="lazy"
            width={96}
            height={96}
            onError={(e) => {
              // Si la foto cargada por el estacionamiento no existe, no se
              // deja el ícono roto del navegador.
              e.currentTarget.src = FOTO_POR_DEFECTO;
            }}
          />
        </div>

        <div className="sn-tarjeta-parking__datos">
          <h3 className="sn-tarjeta-parking__nombre">{nombre}</h3>

          <p className="sn-tarjeta-parking__direccion">
            {direccion}
            {barrio && `, ${barrio}`}
          </p>

          <div className="sn-tarjeta-parking__meta">
            {distanciaMetros !== undefined && (
              <span className="sn-tarjeta-parking__caminando">
                <Icono nombre="pin" tam={14} />
                {textos.resultados.caminando(minutosCaminando)}
                <span className="sn-silencio">({fmtDistancia(distanciaMetros)})</span>
              </span>
            )}
            <Estrellas valor={calificacion} cantidad={cantidadResenas} compacto />
          </div>

          <div className="sn-tarjeta-parking__servicios">
            {horario && (
              <span className="sn-tarjeta-parking__servicio" title={horario}>
                <Icono nombre="reloj" tam={14} />
                {horario}
              </span>
            )}
            {cubierto && (
              <span className="sn-tarjeta-parking__servicio" title={textos.resultados.techado}>
                <Icono nombre="techo" tam={14} />
                {textos.resultados.techado}
              </span>
            )}
            {servicios.slice(0, 2).map((s) => (
              <span key={s} className="sn-tarjeta-parking__servicio" title={textos.parking.servicios[s] ?? s}>
                <Icono nombre={ICONO_SERVICIO[s] ?? 'check'} tam={14} />
                {textos.parking.servicios[s] ?? s}
              </span>
            ))}
          </div>

          {/* Cupos: capacidad total y lo que queda para el horario buscado,
              con la misma cuenta que impide la sobreventa al confirmar. */}
          {disponibilidad?.capacidadTotal > 0 && (
            <p
              className={[
                'sn-tarjeta-parking__cupos',
                sinLugar ? 'sn-tarjeta-parking__cupos--sin-lugar' : '',
                pocosLugares ? 'sn-tarjeta-parking__cupos--pocos' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <Icono nombre={sinLugar ? 'sinLugar' : 'auto'} tam={14} />
              <span>
                {textos.resultados.capacidad(disponibilidad.capacidadTotal)}
                {' · '}
                <strong>
                  {sinLugar
                    ? textos.resultados.sinDisponibilidad
                    : textos.resultados.disponibles(disponibilidad.libres)}
                </strong>
              </span>
            </p>
          )}
        </div>

        <div className="sn-tarjeta-parking__precio">
          {sinLugar ? (
            <span className="sn-tarjeta-parking__no-disponible">
              <Icono nombre="sinLugar" tam={16} />
              {textos.parking.noDisponible}
            </span>
          ) : (
            <>
              <span className="sn-tarjeta-parking__monto">
                {fmtPrecio(mostrarTotal ? precio.total : precioDesde)}
              </span>
              <span className="sn-tarjeta-parking__unidad">
                {mostrarTotal ? textos.resultados.total : textos.resultados.porHora}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="sn-tarjeta-parking__acciones">
        <button
          type="button"
          className="sn-boton sn-boton--primario sn-boton--sm"
          onClick={onReservar}
          disabled={sinLugar}
        >
          {textos.resultados.reservar}
        </button>
      </div>
    </article>
  );
}

/** Esqueleto de carga, con la misma forma que la tarjeta real. */
export function TarjetaParkingEsqueleto() {
  return (
    <div className="sn-tarjeta-parking sn-tarjeta-parking--esqueleto" aria-hidden="true">
      <div className="sn-tarjeta-parking__cuerpo">
        <span className="sn-esqueleto sn-tarjeta-parking__foto" />
        <div className="sn-tarjeta-parking__datos">
          <span className="sn-esqueleto" style={{ height: 17, width: '72%' }} />
          <span className="sn-esqueleto" style={{ height: 13, width: '55%' }} />
          <span className="sn-esqueleto" style={{ height: 13, width: '42%' }} />
        </div>
        <div className="sn-tarjeta-parking__precio">
          <span className="sn-esqueleto" style={{ height: 22, width: 68 }} />
        </div>
      </div>
    </div>
  );
}

export default TarjetaParking;
