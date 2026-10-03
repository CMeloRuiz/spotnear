/**
 * Logo de SpotNear.
 *
 * El isotipo (círculo azul con el pin) es igual en las dos variantes; lo que
 * cambia es el color del wordmark, que tiene que contrastar con el fondo:
 *   · logo_spotnear.png        → wordmark blanco, para fondos oscuros
 *                                (footer, panel, comprobante)
 *   · logo_spotnear_black.png  → wordmark oscuro, para fondos claros
 *                                (header público, login)
 */
import { Link } from 'react-router-dom';
import './Logo.css';

/**
 * Altura en píxeles de cada tamaño. Va como atributo height del <img> para
 * reservar el espacio antes de que cargue (evita el salto de layout) y se
 * repite en Logo.css, que es quien manda en pantalla.
 *
 * Subidos ~36% respecto de la primera versión: el logo quedaba chico al lado
 * del resto del header. En móvil el CSS los baja un escalón.
 */
const ALTO = { sm: 30, md: 38, lg: 46 };

/**
 * @param {object} props
 * @param {'claro'|'oscuro'} [props.variante] claro = para fondos oscuros
 * @param {'sm'|'md'|'lg'} [props.tam]
 * @param {string|null} [props.to] Si es null, no envuelve en un link
 */
export function Logo({ variante = 'oscuro', tam = 'md', to = '/', className = '' }) {
  const archivo = variante === 'claro' ? 'logo_spotnear.png' : 'logo_spotnear_black.png';

  const img = (
    <img
      src={`/assets/${archivo}`}
      alt="SpotNear"
      height={ALTO[tam]}
      className={`sn-logo sn-logo--${tam} ${className}`}
      /* El logo es lo primero que se ve: no conviene diferirlo.
         En minúscula porque React 18 no reconoce la forma camelCase. */
      fetchpriority="high"
    />
  );

  if (to === null) return img;

  return (
    <Link to={to} className="sn-logo-link" aria-label="SpotNear · Ir al inicio">
      {img}
    </Link>
  );
}

export default Logo;
