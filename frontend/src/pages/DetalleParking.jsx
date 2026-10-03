/**
 * Detalle de un estacionamiento.
 */
import { useMemo } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { Icono, ICONO_SERVICIO, ICONO_VEHICULO } from '../components/ui/Iconos.jsx';
import { Cargando, ErrorCarga, Vacio } from '../components/ui/Estado.jsx';
import { Estrellas, Aviso } from '../components/ui/Varios.jsx';
import { MAP_ID, useEstadoMapas } from '../components/mapas/ProveedorMapas.jsx';
import { publico } from '../services/spotnear.service.js';
import { usePedido, useTitulo } from '../hooks/index.js';
import { periodoPorDefecto } from '../hooks/useBusqueda.js';
import { precio as fmtPrecio, fechaLarga, hora, duracion } from '../utils/formato.js';
import { tipoDeHorario, textoDelDia } from '../utils/horarios.js';
import textos from '../i18n/textos.js';
import './DetalleParking.css';

const FOTO_POR_DEFECTO = '/assets/parkings/sin-foto.svg';

const ORDEN_DIAS = [
  ['lun', 'Lunes'],
  ['mar', 'Martes'],
  ['mie', 'Miércoles'],
  ['jue', 'Jueves'],
  ['vie', 'Viernes'],
  ['sab', 'Sábado'],
  ['dom', 'Domingo'],
];

export function DetalleParking() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const navegar = useNavigate();
  const { disponible: hayMapa } = useEstadoMapas();

  const periodo = useMemo(() => {
    const porDefecto = periodoPorDefecto();
    const inicio = params.get('inicio') ? new Date(params.get('inicio')) : porDefecto.inicio;
    const fin = params.get('fin') ? new Date(params.get('fin')) : porDefecto.fin;
    return { inicio, fin };
  }, [params]);


  const { datos, cargando, error, recargar } = usePedido(
    ({ signal }) =>
      publico.detalleParking(
        slug,
        {
          inicio: periodo.inicio.toISOString(),
          fin: periodo.fin.toISOString(),
        },
        { signal },
      ),
    [slug, periodo.inicio.toISOString(), periodo.fin.toISOString()],
  );

  const parking = datos?.parking;
  useTitulo(parking?.nombre);

  if (cargando) return <Cargando texto="Cargando el estacionamiento..." />;

  if (error) {
    return (
      <div className="sn-contenedor sn-seccion">
        {error.status === 404 ? (
          <Vacio
            icono="sinLugar"
            titulo={textos.errores.noEncontrado}
            texto="Este estacionamiento no existe o ya no está publicado."
            accion={
              <Link to="/" className="sn-boton sn-boton--primario">
                {textos.error404.volver}
              </Link>
            }
          />
        ) : (
          <ErrorCarga error={error} onReintentar={recargar} />
        )}
      </div>
    );
  }

  if (!parking) return null;

  const sinLugar = parking.disponibilidad && !parking.disponibilidad.hayLugar;
  const tipoHorario = tipoDeHorario(parking);
  const abierto24h = tipoHorario === 'ABIERTO_24HS';

  const irAReservar = () => {
    const p = new URLSearchParams({
      inicio: periodo.inicio.toISOString(),
      fin: periodo.fin.toISOString(),
    });
    navegar(`/reservar/${parking.slug}?${p.toString()}`);
  };

  const comoLlegar = `https://www.google.com/maps/dir/?api=1&destination=${parking.lat},${parking.lng}`;

  return (
    <div className="sn-detalle">
      <div className="sn-contenedor">
        <button type="button" className="sn-detalle__volver" onClick={() => navegar(-1)}>
          <Icono nombre="flechaIzquierda" tam={16} />
          {textos.parking.volver}
        </button>
      </div>

      {/* ── Galería ── */}
      <div className="sn-contenedor">
        <div className="sn-detalle__galeria">
          {(parking.fotos?.length ? parking.fotos : [{ url: FOTO_POR_DEFECTO, alt: '' }])
            .slice(0, 3)
            .map((f, i) => (
              <img
                key={f.url + i}
                src={f.url}
                alt={f.alt || `${parking.nombre} — foto ${i + 1}`}
                className={`sn-detalle__foto ${i === 0 ? 'sn-detalle__foto--principal' : ''}`}
                loading={i === 0 ? 'eager' : 'lazy'}
                onError={(e) => {
                  e.currentTarget.src = FOTO_POR_DEFECTO;
                }}
              />
            ))}
        </div>
      </div>

      <div className="sn-contenedor sn-detalle__grilla">
        {/* ── Columna principal ── */}
        <div className="sn-detalle__principal">
          <header className="sn-detalle__cabecera">
            <h1 className="sn-detalle__nombre">{parking.nombre}</h1>
            <p className="sn-detalle__direccion">
              <Icono nombre="pin" tam={16} />
              {parking.direccion}
              {parking.barrio && `, ${parking.barrio}`}
            </p>
            <div className="sn-detalle__meta">
              <Estrellas valor={parking.calificacion} cantidad={parking.cantidadResenas} />
              {parking.cubierto && (
                <span className="sn-badge sn-badge--neutro">
                  <Icono nombre="techo" tam={13} />
                  {textos.resultados.cubierto}
                </span>
              )}
              <span className="sn-badge sn-badge--neutro">
                <Icono nombre="estacionamiento" tam={13} />
                {textos.parking.lugares(parking.capacidadTotal)}
              </span>
            </div>
          </header>

          {parking.descripcion && (
            <section className="sn-detalle__seccion">
              <h2 className="sn-detalle__titulo">{textos.parking.sobreElLugar}</h2>
              <p className="sn-detalle__texto">{parking.descripcion}</p>
            </section>
          )}

          {parking.servicios?.length > 0 && (
            <section className="sn-detalle__seccion">
              <h2 className="sn-detalle__titulo">{textos.parking.serviciosTitulo}</h2>
              <ul className="sn-detalle__servicios">
                {parking.servicios.map((s) => (
                  <li key={s}>
                    <Icono nombre={ICONO_SERVICIO[s] ?? 'check'} tam={18} />
                    {textos.parking.servicios[s] ?? s}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="sn-detalle__seccion">
            <h2 className="sn-detalle__titulo">{textos.parking.vehiculosAceptados}</h2>
            <ul className="sn-detalle__servicios">
              {parking.tiposVehiculo.map((t) => (
                <li key={t}>
                  <Icono nombre={ICONO_VEHICULO[t]} tam={18} />
                  {textos.parking.tiposVehiculo[t]}
                </li>
              ))}
              {parking.alturaMaximaCm && (
                <li>
                  <Icono nombre="flechaArriba" tam={18} />
                  {textos.parking.alturaMaxima}: {(parking.alturaMaximaCm / 100).toFixed(2)} m
                </li>
              )}
            </ul>
          </section>

          <section className="sn-detalle__seccion">
            <h2 className="sn-detalle__titulo">{textos.parking.horarios}</h2>
            {abierto24h ? (
              <p className="sn-detalle__texto">
                <Icono nombre="reloj24" tam={17} /> {textos.parking.abierto24h}
              </p>
            ) : (
              <>
                {/* Cierre atado al evento: se avisa arriba, porque cambia la
                    expectativa de toda la tabla de abajo. */}
                {tipoHorario === 'FIN_EVENTO' && (
                  <p className="sn-detalle__texto sn-detalle__aviso-horario">
                    <Icono nombre="evento" tam={17} /> {textos.parking.cierreEventoResumen}
                  </p>
                )}

                <ul className="sn-detalle__horarios">
                  {ORDEN_DIAS.map(([clave, nombre]) => (
                    <li key={clave}>
                      <span>{nombre}</span>
                      <span>{textoDelDia(parking, clave)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {parking.tarifas?.length > 0 && (
            <section className="sn-detalle__seccion">
              <h2 className="sn-detalle__titulo">{textos.parking.tarifasTitulo}</h2>
              <ul className="sn-detalle__tarifas">
                {parking.tarifas.map((t) => (
                  <li key={t.id}>
                    <span>
                      {textos.admin.tarifas.tipos[t.tipo]}
                      {t.vehicleType && ` · ${textos.parking.tiposVehiculo[t.vehicleType]}`}
                      {t.evento && ` · ${t.evento.nombre}`}
                    </span>
                    <strong>{fmtPrecio(t.precio)}</strong>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="sn-detalle__seccion">
            <h2 className="sn-detalle__titulo">{textos.parking.ubicacion}</h2>
            <div className="sn-detalle__mapa">
              {hayMapa ? (
                <Map
                  defaultCenter={{ lat: parking.lat, lng: parking.lng }}
                  defaultZoom={16}
                  mapId={MAP_ID}
                  gestureHandling="cooperative"
                  disableDefaultUI
                  zoomControl
                  className="sn-detalle__mapa-google"
                >
                  <AdvancedMarker position={{ lat: parking.lat, lng: parking.lng }}>
                    <span className="sn-detalle__pin">
                      <Icono nombre="pin" tam={26} />
                    </span>
                  </AdvancedMarker>
                </Map>
              ) : (
                <div className="sn-detalle__mapa-alt">
                  <Icono nombre="mapa" tam={34} />
                  <span>{parking.direccion}</span>
                </div>
              )}
            </div>
            <a
              href={comoLlegar}
              target="_blank"
              rel="noopener noreferrer"
              className="sn-boton sn-boton--secundario"
            >
              <Icono nombre="llegada" tam={17} />
              {textos.parking.comoLlegar}
              <Icono nombre="externo" tam={14} />
            </a>
          </section>
        </div>

        {/* ── Columna de reserva ── */}
        <aside className="sn-detalle__reserva">
          <div className="sn-detalle__caja">
            {parking.precio ? (
              <>
                <div className="sn-detalle__precio">
                  <span className="sn-detalle__monto">{fmtPrecio(parking.precio.total)}</span>
                  <span className="sn-detalle__unidad">{parking.precio.desglose.etiqueta}</span>
                </div>

                <dl className="sn-detalle__periodo">
                  <div>
                    <dt>{textos.comprobante.ingreso}</dt>
                    <dd>
                      {fechaLarga(periodo.inicio)} · {hora(periodo.inicio)}
                    </dd>
                  </div>
                  <div>
                    <dt>{textos.comprobante.salida}</dt>
                    <dd>
                      {fechaLarga(periodo.fin)} · {hora(periodo.fin)}
                    </dd>
                  </div>
                  <div>
                    <dt>Duración</dt>
                    <dd>{duracion(periodo.inicio, periodo.fin)}</dd>
                  </div>
                </dl>

                {sinLugar ? (
                  <Aviso tipo="aviso">
                    No quedan lugares en ese horario. Probá con otro horario u otro estacionamiento.
                  </Aviso>
                ) : (
                  <>
                    {parking.disponibilidad?.libres <= 5 && (
                      <Aviso tipo="aviso">
                        {textos.resultados.lugaresLibres(parking.disponibilidad.libres)}
                      </Aviso>
                    )}
                    <button
                      type="button"
                      className="sn-boton sn-boton--primario sn-boton--lg sn-boton--bloque"
                      onClick={irAReservar}
                    >
                      {textos.parking.reservarAca}
                    </button>
                  </>
                )}
              </>
            ) : (
              <Aviso tipo="info">
                {parking.precioError ?? 'Elegí un horario para ver el precio.'}
              </Aviso>
            )}

            <ul className="sn-detalle__garantias">
              <li>
                <Icono nombre="checkCirculo" tam={16} />
                {textos.checkout.cancelacionGratis}
              </li>
              <li>
                <Icono nombre="checkCirculo" tam={16} />
                {textos.checkout.senaAclaracion}
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default DetalleParking;
