/**
 * Autocompletado de direcciones.
 *
 * Usa la **Places API nueva** de Google (`AutocompleteSuggestion`), que es la
 * que Google recomienda hoy; la clase vieja `Autocomplete` quedó deprecada
 * para proyectos creados desde marzo de 2025.
 *
 * Si no hay API key, si Places no está habilitada o si la llamada falla,
 * cae automáticamente a la lista local de lugares de Buenos Aires. La app
 * nunca se queda sin buscador.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { buscarLugares } from './lugares.js';
import { useDebounce } from '../../hooks/index.js';

const HAY_KEY = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);

/** Sesgo de resultados hacia el AMBA. */
const SESGO_CABA = {
  center: { lat: -34.6037, lng: -58.3816 },
  radius: 40_000,
};

/**
 * @param {string} texto Lo que escribió el usuario
 * @param {{ minimo?: number }} [opciones]
 * @returns {{
 *   sugerencias: Array<{ id: string, nombre: string, detalle: string, placeId?: string, lat?: number, lng?: number, fuente: 'google'|'local' }>,
 *   cargando: boolean,
 *   fuente: 'google'|'local',
 *   resolver: (sugerencia) => Promise<{ lat: number, lng: number, nombre: string }|null>
 * }}
 */
export function useAutocompletado(texto, { minimo = 2 } = {}) {
  const [sugerencias, setSugerencias] = useState(() => buscarLugares(''));
  const [cargando, setCargando] = useState(false);
  const [fuente, setFuente] = useState('local');

  const consulta = useDebounce(texto, 280);
  const sesion = useRef(null);
  const placesRef = useRef(null);
  const googleFallo = useRef(false);

  /** Carga (una sola vez) la librería de Places. */
  const cargarPlaces = useCallback(async () => {
    if (!HAY_KEY || googleFallo.current) return null;
    if (placesRef.current) return placesRef.current;

    try {
      // @vis.gl/react-google-maps ya inyectó el script; acá solo se importa
      // la librería que hace falta.
      if (!window.google?.maps?.importLibrary) return null;
      const places = await window.google.maps.importLibrary('places');
      if (!places?.AutocompleteSuggestion) {
        googleFallo.current = true;
        return null;
      }
      placesRef.current = places;
      return places;
    } catch {
      googleFallo.current = true;
      return null;
    }
  }, []);

  useEffect(() => {
    let vigente = true;

    const q = (consulta ?? '').trim();

    if (q.length < minimo) {
      setSugerencias(buscarLugares(''));
      setFuente('local');
      setCargando(false);
      return undefined;
    }

    // Resultado local inmediato: el usuario ve algo mientras responde Google.
    const locales = buscarLugares(q).map((l) => ({ ...l, fuente: 'local' }));
    setSugerencias(locales);
    setFuente('local');

    (async () => {
      const places = await cargarPlaces();
      if (!places || !vigente) return;

      setCargando(true);
      try {
        // El token de sesión agrupa las pulsaciones de teclas con la consulta
        // final del lugar: Google lo cobra como una sola búsqueda.
        if (!sesion.current) sesion.current = new places.AutocompleteSessionToken();

        const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: q,
          sessionToken: sesion.current,
          includedRegionCodes: ['ar'],
          locationBias: SESGO_CABA,
          language: 'es-419',
          region: 'ar',
        });

        if (!vigente) return;

        const deGoogle = (suggestions ?? [])
          .filter((s) => s.placePrediction)
          .slice(0, 6)
          .map((s) => {
            const p = s.placePrediction;
            return {
              id: p.placeId,
              placeId: p.placeId,
              nombre: p.mainText?.text ?? p.text?.text ?? '',
              detalle: p.secondaryText?.text ?? '',
              _prediccion: p,
              fuente: 'google',
            };
          });

        if (deGoogle.length > 0) {
          setSugerencias(deGoogle);
          setFuente('google');
        }
      } catch {
        // Places no disponible o sin permisos: nos quedamos con lo local.
        googleFallo.current = true;
      } finally {
        if (vigente) setCargando(false);
      }
    })();

    return () => {
      vigente = false;
    };
  }, [consulta, minimo, cargarPlaces]);

  /**
   * Convierte una sugerencia en coordenadas.
   * Las locales ya las traen; las de Google requieren pedir el detalle.
   */
  const resolver = useCallback(async (sugerencia) => {
    if (!sugerencia) return null;

    if (sugerencia.lat !== undefined && sugerencia.lng !== undefined) {
      return { lat: sugerencia.lat, lng: sugerencia.lng, nombre: sugerencia.nombre };
    }

    try {
      const prediccion = sugerencia._prediccion;
      if (!prediccion?.toPlace) return null;

      const lugar = prediccion.toPlace();
      await lugar.fetchFields({ fields: ['location', 'formattedAddress', 'displayName'] });

      // Se cierra la sesión: la próxima búsqueda empieza una nueva.
      sesion.current = null;

      const loc = lugar.location;
      if (!loc) return null;

      return {
        lat: typeof loc.lat === 'function' ? loc.lat() : loc.lat,
        lng: typeof loc.lng === 'function' ? loc.lng() : loc.lng,
        nombre: lugar.displayName ?? sugerencia.nombre,
        direccion: lugar.formattedAddress ?? sugerencia.detalle,
      };
    } catch {
      return null;
    }
  }, []);

  return { sugerencias, cargando, fuente, resolver };
}

export default useAutocompletado;
