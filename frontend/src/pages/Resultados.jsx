/**
 * Resultados de búsqueda: lista a la izquierda, mapa a la derecha.
 * En el celular se alterna entre las dos vistas con un botón flotante.
 */
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import BarraBusqueda from '../components/busqueda/BarraBusqueda.jsx';
import TarjetaParking, { TarjetaParkingEsqueleto } from '../components/resultados/TarjetaParking.jsx';
import Filtros from '../components/resultados/Filtros.jsx';
import MapaResultados from '../components/resultados/MapaResultados.jsx';
import { Icono } from '../components/ui/Iconos.jsx';
import { Vacio, ErrorCarga } from '../components/ui/Estado.jsx';
import { Interruptor } from '../components/ui/Varios.jsx';
import { publico } from '../services/spotnear.service.js';
import { usePedido, useEsMovil, useTitulo } from '../hooks/index.js';
import { useBusqueda } from '../hooks/useBusqueda.js';
import { textoMostrarTotal } from '../utils/escalones.js';
import textos from '../i18n/textos.js';
import './Resultados.css';

export function Resultados() {
  const navegar = useNavigate();
  const esMovil = useEsMovil();

  const { busqueda, filtros, actualizar, limpiarFiltros, hayFiltros, paraApi, listaParaBuscar } =
    useBusqueda();

  const [resaltado, setResaltado] = useState(null);
  const [seleccionado, setSeleccionado] = useState(null);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [vistaMovil, setVistaMovil] = useState('lista');

  const refsTarjetas = useRef(new Map());

  useTitulo(
    busqueda.destino?.nombre
      ? `Estacionamientos cerca de ${busqueda.destino.nombre}`
      : textos.resultados.titulo,
  );

  const { datos, cargando, error, recargar } = usePedido(
    ({ signal }) => publico.buscarParkings(paraApi, { signal }),
    [JSON.stringify(paraApi)],
    { inmediato: listaParaBuscar },
  );

  const resultados = useMemo(() => datos?.resultados ?? [], [datos]);

  const precioMaximoVisto = useMemo(
    () => resultados.reduce((max, r) => Math.max(max, r.precio?.total ?? 0), 0),
    [resultados],
  );

  /** Al tocar una burbuja del mapa, se abre su tarjeta y se la trae a la vista. */
  const seleccionarDesdeMapa = useCallback(
    (resultado) => {
      if (!resultado) {
        setSeleccionado(null);
        return;
      }
      setSeleccionado(resultado.id);
      if (esMovil) {
        setVistaMovil('lista');
        // Se espera a que la lista se monte antes de desplazarla.
        setTimeout(() => {
          refsTarjetas.current.get(resultado.id)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 60);
      } else {
        refsTarjetas.current.get(resultado.id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    },
    [esMovil],
  );

  /** "Buscar en esta zona": se mueve el destino al centro actual del mapa. */
  const buscarEnZona = useCallback(
    (centro) => {
      actualizar({ destino: { nombre: 'Esta zona', lat: centro.lat, lng: centro.lng } });
    },
    [actualizar],
  );

  const irAReservar = useCallback(
    (resultado) => {
      const params = new URLSearchParams({
        inicio: busqueda.inicio.toISOString(),
        fin: busqueda.fin.toISOString(),
      });
      if (filtros.tipoVehiculo) params.set('tipoVehiculo', filtros.tipoVehiculo);
      navegar(`/reservar/${resultado.slug}?${params.toString()}`);
    },
    [busqueda, filtros, navegar],
  );

  // Si no hay destino, no hay nada que buscar: se manda a la home.
  useEffect(() => {
    if (!busqueda.destino) {
      const t = setTimeout(() => navegar('/', { replace: true }), 2500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [busqueda.destino, navegar]);

  const hayResultados = resultados.length > 0;

  return (
    <div className="sn-resultados">
      <BarraBusqueda
        busqueda={busqueda}
        onBuscar={(nueva) =>
          actualizar({
            destino: nueva.destino,
            inicio: nueva.inicio,
            fin: nueva.fin,
            modalidad: nueva.modalidad,
          })
        }
      />

      {/* ───────────── Barra de herramientas ───────────── */}
      <div className="sn-resultados__herramientas">
        <div className="sn-contenedor sn-contenedor--ancho sn-resultados__herramientas-interior">
          <div className="sn-resultados__acciones">
            <button
              type="button"
              className={`sn-boton sn-boton--secundario sn-boton--sm ${hayFiltros ? 'sn-resultados__filtros--activo' : ''}`}
              onClick={() => setFiltrosAbiertos(true)}
            >
              <Icono nombre="filtro" tam={16} />
              {textos.resultados.filtros}
              {hayFiltros && <span className="sn-resultados__punto" aria-label="Hay filtros activos" />}
            </button>

            {/* Atajos a los filtros que más se usan */}
            <button
              type="button"
              className={`sn-chip sn-chip--sm ${filtros.cubierto === true ? 'sn-chip--activo' : ''}`}
              onClick={() => actualizar({ cubierto: filtros.cubierto === true ? null : true })}
            >
              <Icono nombre="techo" tam={15} />
              {textos.resultados.cubierto}
            </button>

            <button
              type="button"
              className={`sn-chip sn-chip--sm ${filtros.servicios.includes('24hs') ? 'sn-chip--activo' : ''}`}
              onClick={() =>
                actualizar({
                  servicios: filtros.servicios.includes('24hs')
                    ? filtros.servicios.filter((s) => s !== '24hs')
                    : [...filtros.servicios, '24hs'],
                })
              }
            >
              <Icono nombre="reloj24" tam={15} />
              24 horas
            </button>
          </div>

          <div className="sn-resultados__ajustes">
            <Interruptor
              id="mostrar-total"
              activo={filtros.mostrarTotal}
              onChange={(v) => actualizar({ mostrarTotal: v })}
              etiqueta={textoMostrarTotal(textos.resultados, busqueda.inicio, busqueda.fin)}
            />

            <label className="sn-resultados__orden">
              <span className="sn-solo-lectores">{textos.resultados.ordenarPor}</span>
              <select
                className="sn-select"
                value={filtros.orden}
                onChange={(e) => actualizar({ orden: e.target.value })}
              >
                {Object.entries(textos.resultados.orden).map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>
                    {textos.resultados.ordenarPor}: {etiqueta}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      {/* ───────────── Contenido ───────────── */}
      <div className={`sn-resultados__cuerpo sn-resultados__cuerpo--${vistaMovil}`}>
        <section className="sn-resultados__lista" aria-label={textos.resultados.titulo}>
          <div className="sn-resultados__lista-interior">
            {!busqueda.destino && (
              <Vacio
                icono="pin"
                titulo={textos.busqueda.elegiDestino}
                texto="Te llevamos al inicio para que elijas a dónde vas."
                accion={
                  <Link to="/" className="sn-boton sn-boton--primario">
                    {textos.error404.volver}
                  </Link>
                }
              />
            )}

            {busqueda.destino && cargando && (
              <>
                <p className="sn-resultados__contador" aria-live="polite">
                  {textos.resultados.cargando}
                </p>
                {[0, 1, 2, 3].map((i) => (
                  <TarjetaParkingEsqueleto key={i} />
                ))}
              </>
            )}

            {busqueda.destino && !cargando && error && (
              <ErrorCarga error={error} onReintentar={recargar} />
            )}

            {busqueda.destino && !cargando && !error && !hayResultados && (
              <Vacio
                icono="sinLugar"
                titulo={textos.resultados.sinResultados}
                texto={textos.resultados.sinResultadosTexto}
                accion={
                  hayFiltros && (
                    <button type="button" className="sn-boton sn-boton--secundario" onClick={limpiarFiltros}>
                      {textos.resultados.limpiarFiltros}
                    </button>
                  )
                }
              />
            )}

            {busqueda.destino && !cargando && !error && hayResultados && (
              <>
                <p className="sn-resultados__contador" aria-live="polite">
                  {textos.resultados.encontrados(resultados.length)}
                  {busqueda.destino.nombre && (
                    <span className="sn-silencio"> cerca de {busqueda.destino.nombre}</span>
                  )}
                </p>

                {resultados.map((r) => (
                  <TarjetaParking
                    key={r.id}
                    resultado={r}
                    mostrarTotal={filtros.mostrarTotal}
                    resaltado={resaltado === r.id}
                    seleccionado={seleccionado === r.id}
                    onResaltar={setResaltado}
                    onReservar={() => irAReservar(r)}
                    innerRef={(el) => {
                      if (el) refsTarjetas.current.set(r.id, el);
                      else refsTarjetas.current.delete(r.id);
                    }}
                  />
                ))}
              </>
            )}
          </div>
        </section>

        <section className="sn-resultados__mapa" aria-label="Mapa de estacionamientos">
          <MapaResultados
            resultados={resultados}
            centro={busqueda.destino}
            resaltado={resaltado}
            seleccionado={seleccionado}
            mostrarTotal={filtros.mostrarTotal}
            onSeleccionar={seleccionarDesdeMapa}
            onResaltar={setResaltado}
            onBuscarZona={buscarEnZona}
          />
        </section>
      </div>

      {/* Alternancia lista/mapa en el celular */}
      <button
        type="button"
        className="sn-resultados__cambiar-vista sn-solo-movil"
        onClick={() => setVistaMovil((v) => (v === 'lista' ? 'mapa' : 'lista'))}
      >
        <Icono nombre={vistaMovil === 'lista' ? 'mapa' : 'lista'} tam={17} />
        {vistaMovil === 'lista' ? textos.resultados.verMapa : textos.resultados.verLista}
      </button>

      <Filtros
        abierto={filtrosAbiertos}
        alCerrar={() => setFiltrosAbiertos(false)}
        filtros={filtros}
        onAplicar={actualizar}
        onLimpiar={limpiarFiltros}
        precioMaximoVisto={precioMaximoVisto}
      />
    </div>
  );
}

export default Resultados;
