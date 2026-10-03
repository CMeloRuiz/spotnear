/**
 * Carga de Google Maps para toda la app.
 *
 * Se monta una sola vez en la raíz —y no dentro del mapa— porque el buscador
 * de direcciones de la home también necesita la librería Places. Si no hay
 * API key, no se carga nada y los componentes usan sus alternativas.
 */
import { APIProvider, useApiLoadingStatus, APILoadingStatus } from '@vis.gl/react-google-maps';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
export const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

/** ¿Hay key configurada? No garantiza que cargue bien, solo que se va a intentar. */
export const HAY_API_KEY = Boolean(API_KEY);

export function ProveedorMapas({ children }) {
  if (!HAY_API_KEY) return children;

  return (
    <APIProvider
      apiKey={API_KEY}
      language="es-419"
      region="AR"
      libraries={['places', 'marker']}
      /* Se cargan las librerías al arranque para que el autocompletado esté
         listo desde la primera tecla que escribe el usuario. */
      onError={(error) => console.warn('[Google Maps] no se pudo cargar:', error?.message ?? error)}
    >
      {children}
    </APIProvider>
  );
}

/**
 * ¿Google Maps está realmente disponible?
 * Distingue "todavía cargando" de "falló": una key inválida o sin la API
 * habilitada termina en FAILED / AUTH_FAILURE, y ahí hay que mostrar
 * el mapa alternativo en lugar de dejar un recuadro gris para siempre.
 */
export function useEstadoMapas() {
  const estado = useApiLoadingStatus();

  if (!HAY_API_KEY) return { disponible: false, cargando: false, fallo: false, motivo: 'sin_key' };

  const fallo = estado === APILoadingStatus.FAILED || estado === APILoadingStatus.AUTH_FAILURE;

  return {
    disponible: estado === APILoadingStatus.LOADED,
    cargando: estado === APILoadingStatus.LOADING || estado === APILoadingStatus.NOT_LOADED,
    fallo,
    motivo: fallo ? 'error_carga' : null,
  };
}

export default ProveedorMapas;
