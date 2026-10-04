/**
 * Mapa de resultados.
 *
 * Con API key usa Google Maps de verdad (Maps JavaScript API + marcadores
 * avanzados). Sin key —o si Google no carga— cae a un mapa alternativo propio
 * que ubica las burbujas de precio por proyección de coordenadas. No es un
 * mapa navegable, pero deja ver dónde está cada estacionamiento y hace que la
 * app se pueda usar y probar igual.
 */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { Icono } from '../ui/Iconos.jsx';
import { precio as fmtPrecio } from '../../utils/formato.js';
import { MAP_ID, useEstadoMapas } from '../mapas/ProveedorMapas.jsx';
import textos from '../../i18n/textos.js';
import { leyendaHorario } from '../../utils/horarios.js';
import './MapaResultados.css';

/* ═══════════════════ Burbuja de precio ═══════════════════ */

/**
 * Tooltip del marcador: "Parking X · 60 lugares · 12 disponibles en tu horario
 * · Abre 06:00 · Cierra 22:00".
 */
function cupos(resultado, fecha) {
  const d = resultado.disponibilidad;
  const partes = [resultado.nombre];
  if (d?.capacidadTotal) {
    partes.push(textos.resultados.capacidad(d.capacidadTotal));
    partes.push(d.hayLugar ? textos.resultados.disponibles(d.libres) : textos.resultados.sinDisponibilidad);
  }
  const horario = leyendaHorario(resultado, fecha);
  if (horario) partes.push(horario);
  return partes.join(' · ');
}

function Burbuja({ resultado, resaltado, seleccionado, mostrarTotal, onClick, onHover, fecha }) {
  const valor = mostrarTotal ? resultado.precio.total : resultado.precioDesde;
  const sinLugar = !resultado.disponibilidad?.hayLugar;

  return (
    <button
      type="button"
      className={[
        'sn-burbuja',
        resaltado ? 'sn-burbuja--resaltada' : '',
        seleccionado ? 'sn-burbuja--seleccionada' : '',
        sinLugar ? 'sn-burbuja--sin-lugar' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={(e) => {
        e.stopPropagation();
        onClick(resultado);
      }}
      onMouseEnter={() => onHover(resultado.id)}
      onMouseLeave={() => onHover(null)}
      aria-label={`${resultado.nombre}, ${fmtPrecio(valor)}`}
      title={cupos(resultado, fecha)}
    >
      {fmtPrecio(valor)}
    </button>
  );
}

/* ═══════════════════ Google Maps ═══════════════════ */

/** Zoom máximo al encuadrar: más cerca que esto se pierden las calles de alrededor. */
const ZOOM_MAXIMO_ENCUADRE = 16;

/**
 * Ajusta el encuadre para que entren todos los resultados.
 * Vive en un componente aparte porque `useMap` necesita estar dentro de <Map>.
 *
 * Dos errores que tenía y que dejaban el mapa "corrido":
 *
 *  1. La firma que decide cuándo reencuadrar era solo la lista de ids. Buscar
 *     otro lugar que devolviera los mismos estacionamientos (con uno solo
 *     cargado, pasa siempre) no movía el mapa: el marcador de destino se iba a
 *     otra parte y el mapa se quedaba donde estaba. Ahora la firma incluye el
 *     destino.
 *  2. `fitBounds` con un margen chico acerca el zoom hasta que los puntos tocan
 *     el borde. Con el destino y un solo estacionamiento eso es una diagonal:
 *     cada punto terminaba en una esquina opuesta y el estacionamiento —lo que
 *     el usuario quiere ver— quedaba pegado al borde. Ahora el margen es
 *     proporcional al tamaño del mapa y el zoom tiene tope, así los resultados
 *     quedan en la zona central.
 */
function AjustarEncuadre({ resultados, centro, alMoverse }) {
  const mapa = useMap();
  const ultimoAjuste = useRef('');

  useEffect(() => {
    if (!mapa || resultados.length === 0) return;

    // Solo se reencuadra cuando cambia la búsqueda (destino o resultados); si
    // no, el mapa pelearía contra el usuario cada vez que arrastra.
    const firma = [
      centro ? `${centro.lat.toFixed(5)},${centro.lng.toFixed(5)}` : '',
      ...resultados.map((r) => r.id),
    ].join('|');
    if (firma === ultimoAjuste.current) return;
    ultimoAjuste.current = firma;

    const limites = new window.google.maps.LatLngBounds();
    for (const r of resultados) limites.extend({ lat: r.lat, lng: r.lng });
    if (centro) limites.extend(centro);

    // Margen de un 20% de cada lado. Arriba un poco más: la burbuja de precio se
    // dibuja por encima de su punto y, si no, se corta contra el borde.
    const div = mapa.getDiv();
    const ancho = div?.clientWidth || 600;
    const alto = div?.clientHeight || 600;
    const margenX = Math.round(ancho * 0.2);
    const margenY = Math.round(alto * 0.2);

    mapa.fitBounds(limites, { top: margenY + 40, right: margenX, bottom: margenY, left: margenX });

    // fitBounds es asincrónico: el zoom final se conoce recién en el `idle`.
    // No se limpia en el cleanup a propósito: si el efecto se vuelve a correr
    // con la misma búsqueda, el tope de zoom igual tiene que aplicarse.
    window.google.maps.event.addListenerOnce(mapa, 'idle', () => {
      if ((mapa.getZoom() ?? 0) > ZOOM_MAXIMO_ENCUADRE) mapa.setZoom(ZOOM_MAXIMO_ENCUADRE);
    });
  }, [mapa, resultados, centro]);

  // Avisa cuando el usuario mueve el mapa, para ofrecer "Buscar en esta zona".
  useEffect(() => {
    if (!mapa) return undefined;
    const listener = mapa.addListener('dragend', () => {
      const c = mapa.getCenter();
      if (c) alMoverse({ lat: c.lat(), lng: c.lng() });
    });
    return () => listener.remove();
  }, [mapa, alMoverse]);

  return null;
}

function MapaGoogle({
  resultados,
  centro,
  resaltado,
  seleccionado,
  mostrarTotal,
  fecha,
  onSeleccionar,
  onResaltar,
  onBuscarZona,
}) {
  const [zonaMovida, setZonaMovida] = useState(null);

  const alMoverse = useCallback((nuevoCentro) => setZonaMovida(nuevoCentro), []);

  // Al llegar resultados nuevos, se descarta el aviso de "buscar en esta zona".
  useEffect(() => {
    setZonaMovida(null);
  }, [resultados]);

  return (
    <div className="sn-mapa__contenedor">
      <Map
        defaultCenter={centro}
        defaultZoom={14}
        mapId={MAP_ID}
        gestureHandling="greedy"
        disableDefaultUI={false}
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        zoomControl
        className="sn-mapa__google"
        onClick={() => onSeleccionar(null)}
      >
        <AjustarEncuadre resultados={resultados} centro={centro} alMoverse={alMoverse} />

        {/* Dónde buscó el usuario */}
        {centro && (
          <AdvancedMarker position={centro} zIndex={1} title="Tu destino">
            <span className="sn-mapa__destino" aria-hidden="true">
              <span className="sn-mapa__destino-punto" />
            </span>
          </AdvancedMarker>
        )}

        {resultados.map((r) => (
          <AdvancedMarker
            key={r.id}
            position={{ lat: r.lat, lng: r.lng }}
            zIndex={seleccionado === r.id ? 30 : resaltado === r.id ? 20 : 10}
          >
            <Burbuja
              resultado={r}
              resaltado={resaltado === r.id}
              seleccionado={seleccionado === r.id}
              mostrarTotal={mostrarTotal}
              fecha={fecha}
              onClick={onSeleccionar}
              onHover={onResaltar}
            />
          </AdvancedMarker>
        ))}
      </Map>

      {zonaMovida && (
        <button
          type="button"
          className="sn-mapa__buscar-zona"
          onClick={() => {
            onBuscarZona(zonaMovida);
            setZonaMovida(null);
          }}
        >
          <Icono nombre="lupa" tam={16} />
          {textos.resultados.buscarEnEstaZona}
        </button>
      )}
    </div>
  );
}

/* ═══════════════════ Mapa alternativo (sin API key) ═══════════════════ */

/**
 * Proyecta lat/lng a porcentajes dentro de la caja, con un margen para que
 * ninguna burbuja quede pegada al borde.
 */
function proyectar(resultados, centro) {
  const puntos = [...resultados.map((r) => ({ lat: r.lat, lng: r.lng })), centro].filter(Boolean);
  if (puntos.length === 0) return () => ({ x: 50, y: 50 });

  const lats = puntos.map((p) => p.lat);
  const lngs = puntos.map((p) => p.lng);

  // Se fuerza un rango mínimo: con un solo resultado, sin esto se divide por cero.
  const latMin = Math.min(...lats);
  const latMax = Math.max(...lats);
  const lngMin = Math.min(...lngs);
  const lngMax = Math.max(...lngs);

  const rangoLat = Math.max(latMax - latMin, 0.004);
  const rangoLng = Math.max(lngMax - lngMin, 0.004);
  const centroLat = (latMin + latMax) / 2;
  const centroLng = (lngMin + lngMax) / 2;

  const MARGEN = 14; // % de cada lado

  return (lat, lng) => ({
    // La latitud crece hacia el norte y la pantalla hacia abajo: se invierte.
    y: 50 - ((lat - centroLat) / rangoLat) * (100 - MARGEN * 2),
    x: 50 + ((lng - centroLng) / rangoLng) * (100 - MARGEN * 2),
  });
}

function MapaAlternativo({
  resultados,
  centro,
  resaltado,
  seleccionado,
  mostrarTotal,
  fecha,
  onSeleccionar,
  onResaltar,
}) {
  const proyectarPunto = useMemo(() => proyectar(resultados, centro), [resultados, centro]);

  return (
    <div className="sn-mapa-alt">
      <div className="sn-mapa-alt__trama" aria-hidden="true" />

      <div className="sn-mapa-alt__aviso">
        <Icono nombre="info" tam={15} />
        <span>
          Mapa simplificado. Configurá <code>VITE_GOOGLE_MAPS_API_KEY</code> para ver Google Maps.
        </span>
      </div>

      <div className="sn-mapa-alt__lienzo">
        {centro && (
          <span
            className="sn-mapa-alt__destino"
            style={(() => {
              const p = proyectarPunto(centro.lat, centro.lng);
              return { left: `${p.x}%`, top: `${p.y}%` };
            })()}
            title="Tu destino"
          >
            <span className="sn-mapa__destino-punto" />
          </span>
        )}

        {resultados.map((r) => {
          const p = proyectarPunto(r.lat, r.lng);
          return (
            <span
              key={r.id}
              className="sn-mapa-alt__marcador"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                zIndex: seleccionado === r.id ? 30 : resaltado === r.id ? 20 : 10,
              }}
            >
              <Burbuja
                resultado={r}
                resaltado={resaltado === r.id}
                seleccionado={seleccionado === r.id}
                mostrarTotal={mostrarTotal}
                fecha={fecha}
                onClick={onSeleccionar}
                onHover={onResaltar}
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════ Componente público ═══════════════════ */

/**
 * @param {object} props
 * @param {Array} props.resultados
 * @param {{ lat: number, lng: number }} props.centro
 * @param {string|null} props.resaltado      Id resaltado por hover en la lista
 * @param {string|null} props.seleccionado   Id con la tarjeta abierta
 * @param {boolean} props.mostrarTotal
 * @param {(r: object|null) => void} props.onSeleccionar
 * @param {(id: string|null) => void} props.onResaltar
 * @param {(centro: { lat: number, lng: number }) => void} props.onBuscarZona
 */
export function MapaResultados(props) {
  const { resultados = [], centro } = props;
  const { disponible, cargando } = useEstadoMapas();

  const centroSeguro = centro ?? { lat: -34.6037, lng: -58.3816 };

  if (cargando) {
    return (
      <div className="sn-mapa__cargando">
        <span className="sn-spinner sn-spinner--lg" aria-hidden="true" />
        <span>Cargando el mapa...</span>
      </div>
    );
  }

  // Sin key, o si Google falló (key inválida, API sin habilitar, sin red):
  // se muestra el mapa alternativo en lugar de un recuadro vacío.
  if (!disponible) {
    return <MapaAlternativo {...props} centro={centroSeguro} resultados={resultados} />;
  }

  return <MapaGoogle {...props} centro={centroSeguro} resultados={resultados} />;
}

export default MapaResultados;
