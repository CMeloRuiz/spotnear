/**
 * Estado de la búsqueda, sincronizado con la URL.
 *
 * Que viva en la URL y no en memoria tiene tres efectos concretos:
 *  · se puede compartir el link de una búsqueda,
 *  · el botón "atrás" del navegador funciona como se espera,
 *  · recargar la página no pierde lo que el usuario había elegido.
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Redondea hacia arriba al próximo bloque de 30 minutos. */
function proximaMediaHora(desde = new Date()) {
  const d = new Date(desde);
  d.setSeconds(0, 0);
  const minutos = d.getMinutes();
  d.setMinutes(minutos <= 30 ? 30 : 60);
  return d;
}

/** Valores por defecto: de acá a 3 horas, el caso más común. */
/** Duración precargada entre ingreso y salida, en horas. */
export const DURACION_POR_DEFECTO_HORAS = 4;

export function periodoPorDefecto() {
  const inicio = proximaMediaHora(new Date(Date.now() + 15 * 60_000));
  // 4 horas: es la estadía típica y además el piso de la media estadía, así
  // el precio que ve el que llega a la home ya es el del escalón que más se usa.
  const fin = new Date(inicio.getTime() + DURACION_POR_DEFECTO_HORAS * 3_600_000);
  return { inicio, fin };
}

const aFecha = (valor, porDefecto) => {
  if (!valor) return porDefecto;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? porDefecto : d;
};

/**
 * Convierte un parámetro de la URL a número.
 *
 * El guardia de null/'' NO es opcional: `Number(null)` y `Number('')` dan 0,
 * que es un valor finito. Sin esto, un parámetro ausente se convertía en 0 y
 * la búsqueda salía con radio=0 (rechazado por la API) y con un destino
 * fantasma en la coordenada (0, 0).
 */
const aNumero = (valor) => {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
};

/**
 * @returns {{
 *   busqueda: object,
 *   filtros: object,
 *   actualizar: (cambios: object) => void,
 *   limpiarFiltros: () => void,
 *   hayFiltros: boolean,
 *   paraApi: object,
 *   listaParaBuscar: boolean
 * }}
 */
export function useBusqueda() {
  const [params, setParams] = useSearchParams();

  const busqueda = useMemo(() => {
    const porDefecto = periodoPorDefecto();
    const lat = aNumero(params.get('lat'));
    const lng = aNumero(params.get('lng'));

    return {
      destino: lat !== null && lng !== null ? { nombre: params.get('q') ?? '', lat, lng } : null,
      inicio: aFecha(params.get('inicio'), porDefecto.inicio),
      fin: aFecha(params.get('fin'), porDefecto.fin),
      modalidad: params.get('modalidad') === 'MENSUAL' ? 'MENSUAL' : 'HORARIO',
    };
  }, [params]);

  const filtros = useMemo(
    () => ({
      radio: aNumero(params.get('radio')) ?? 2500,
      tipoVehiculo: params.get('tipoVehiculo') || null,
      cubierto: params.get('cubierto') === null ? null : params.get('cubierto') === 'true',
      precioMax: aNumero(params.get('precioMax')),
      calificacionMin: aNumero(params.get('calificacionMin')),
      servicios: params.get('servicios') ? params.get('servicios').split(',').filter(Boolean) : [],
      orden: params.get('orden') || 'RELEVANCIA',
      mostrarTotal: params.get('total') !== 'false',
    }),
    [params],
  );

  /**
   * Aplica cambios sobre la URL. Los valores nulos o vacíos se borran del
   * querystring para que el link no se llene de basura.
   */
  const actualizar = useCallback(
    (cambios, { reemplazar = false } = {}) => {
      setParams(
        (previos) => {
          const nuevos = new URLSearchParams(previos);

          const poner = (clave, valor) => {
            if (valor === null || valor === undefined || valor === '') nuevos.delete(clave);
            else nuevos.set(clave, String(valor));
          };

          if ('destino' in cambios) {
            const d = cambios.destino;
            poner('q', d?.nombre ?? null);
            poner('lat', d?.lat ?? null);
            poner('lng', d?.lng ?? null);
          }
          if ('inicio' in cambios) poner('inicio', cambios.inicio?.toISOString?.() ?? cambios.inicio);
          if ('fin' in cambios) poner('fin', cambios.fin?.toISOString?.() ?? cambios.fin);
          if ('modalidad' in cambios) {
            poner('modalidad', cambios.modalidad === 'MENSUAL' ? 'MENSUAL' : null);
          }
          if ('radio' in cambios) poner('radio', cambios.radio === 2500 ? null : cambios.radio);
          if ('tipoVehiculo' in cambios) poner('tipoVehiculo', cambios.tipoVehiculo);
          if ('cubierto' in cambios) {
            poner('cubierto', cambios.cubierto === null ? null : cambios.cubierto);
          }
          if ('precioMax' in cambios) poner('precioMax', cambios.precioMax);
          if ('calificacionMin' in cambios) poner('calificacionMin', cambios.calificacionMin);
          if ('servicios' in cambios) {
            poner('servicios', cambios.servicios?.length ? cambios.servicios.join(',') : null);
          }
          if ('orden' in cambios) poner('orden', cambios.orden === 'RELEVANCIA' ? null : cambios.orden);
          if ('mostrarTotal' in cambios) poner('total', cambios.mostrarTotal ? null : 'false');

          return nuevos;
        },
        { replace: reemplazar },
      );
    },
    [setParams],
  );

  const limpiarFiltros = useCallback(() => {
    actualizar({
      radio: 2500,
      tipoVehiculo: null,
      cubierto: null,
      precioMax: null,
      calificacionMin: null,
      servicios: [],
      orden: 'RELEVANCIA',
    });
  }, [actualizar]);

  const hayFiltros =
    filtros.tipoVehiculo !== null ||
    filtros.cubierto !== null ||
    filtros.precioMax !== null ||
    filtros.calificacionMin !== null ||
    filtros.servicios.length > 0 ||
    filtros.radio !== 2500;

  const listaParaBuscar = Boolean(busqueda.destino && busqueda.fin > busqueda.inicio);

  /** Parámetros con el formato que espera la API. */
  const paraApi = useMemo(
    () => ({
      lat: busqueda.destino?.lat,
      lng: busqueda.destino?.lng,
      radio: filtros.radio,
      inicio: busqueda.inicio.toISOString(),
      fin: busqueda.fin.toISOString(),
      modalidad: busqueda.modalidad,
      tipoVehiculo: filtros.tipoVehiculo ?? undefined,
      cubierto: filtros.cubierto === null ? undefined : filtros.cubierto,
      precioMax: filtros.precioMax ?? undefined,
      calificacionMin: filtros.calificacionMin ?? undefined,
      servicios: filtros.servicios,
      orden: filtros.orden,
    }),
    [busqueda, filtros],
  );

  return { busqueda, filtros, actualizar, limpiarFiltros, hayFiltros, paraApi, listaParaBuscar };
}

/** Arma el querystring de /buscar a partir de un estado de búsqueda. */
export function urlBusqueda({ destino, inicio, fin, modalidad = 'HORARIO' }) {
  const p = new URLSearchParams();
  if (destino) {
    if (destino.nombre) p.set('q', destino.nombre);
    p.set('lat', String(destino.lat));
    p.set('lng', String(destino.lng));
  }
  if (inicio) p.set('inicio', inicio instanceof Date ? inicio.toISOString() : inicio);
  if (fin) p.set('fin', fin instanceof Date ? fin.toISOString() : fin);
  if (modalidad === 'MENSUAL') p.set('modalidad', 'MENSUAL');
  return `/buscar?${p.toString()}`;
}

export default useBusqueda;
