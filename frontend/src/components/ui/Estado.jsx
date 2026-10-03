/**
 * Estados de pantalla: cargando, vacío y error.
 *
 * Todas las vistas que traen datos usan estos tres componentes, así el
 * comportamiento es el mismo en toda la app y ninguna pantalla se queda en
 * blanco sin explicar qué pasó.
 */
import { Icono } from './Iconos.jsx';
import textos from '../../i18n/textos.js';
import './Estado.css';

/** Spinner con texto. */
export function Cargando({ texto = textos.comunes.cargando, className = '' }) {
  return (
    <div className={`sn-cargando ${className}`} role="status" aria-live="polite">
      <span className="sn-spinner sn-spinner--lg" aria-hidden="true" />
      <span className="sn-cargando__texto">{texto}</span>
    </div>
  );
}

/** Rectángulo gris animado, del alto que se le pida. */
export function Esqueleto({ alto = 16, ancho = '100%', radio, className = '', style }) {
  return (
    <span
      className={`sn-esqueleto ${className}`}
      aria-hidden="true"
      style={{
        display: 'block',
        height: typeof alto === 'number' ? `${alto}px` : alto,
        width: typeof ancho === 'number' ? `${ancho}px` : ancho,
        borderRadius: radio,
        ...style,
      }}
    />
  );
}

/**
 * Estado vacío: no hay datos, pero no hubo error.
 * @param {object} props
 * @param {string} [props.icono]
 * @param {string} props.titulo
 * @param {string} [props.texto]
 * @param {React.ReactNode} [props.accion]
 */
export function Vacio({ icono = 'lupa', titulo, texto, accion, className = '' }) {
  return (
    <div className={`sn-vacio ${className}`}>
      <span className="sn-vacio__icono">
        <Icono nombre={icono} tam={46} grosor={1.3} />
      </span>
      <p className="sn-vacio__titulo">{titulo}</p>
      {texto && <p className="sn-vacio__texto">{texto}</p>}
      {accion && <div className="sn-vacio__accion">{accion}</div>}
    </div>
  );
}

/**
 * Error de carga, con botón de reintentar.
 * @param {Error} error
 * @param {() => void} [onReintentar]
 */
export function ErrorCarga({ error, onReintentar, className = '' }) {
  // Un fallo de red se explica distinto que un error del servidor: al usuario
  // le sirve saber si el problema es suyo o nuestro.
  const esDeConexion = error?.codigo === 'SIN_CONEXION' || error?.codigo === 'TIMEOUT';

  const mensaje = esDeConexion
    ? textos.errores.servidorCaido
    : (error?.message ?? textos.errores.generico);

  return (
    <div className={`sn-error-carga ${className}`} role="alert">
      <span className="sn-error-carga__icono">
        <Icono nombre="alerta" tam={40} grosor={1.4} />
      </span>
      <p className="sn-error-carga__titulo">No pudimos cargar esta información</p>
      <p className="sn-error-carga__texto">{mensaje}</p>
      {onReintentar && (
        <button type="button" className="sn-boton sn-boton--secundario" onClick={onReintentar}>
          <Icono nombre="flechaDerecha" tam={16} />
          {textos.errores.reintentar}
        </button>
      )}
    </div>
  );
}

/**
 * Atajo: decide qué mostrar según el estado de un `usePedido`.
 * Si hay datos, renderiza los hijos.
 */
export function Contenido({ cargando, error, vacio, onReintentar, textoCarga, estadoVacio, children }) {
  if (cargando) return <Cargando texto={textoCarga} />;
  if (error) return <ErrorCarga error={error} onReintentar={onReintentar} />;
  if (vacio) return estadoVacio ?? null;
  return children;
}

export default Cargando;
