/**
 * Encabezado del sitio público.
 * Logo a la izquierda, navegación a la derecha; en móvil, menú desplegable.
 */
import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import Logo from './Logo.jsx';
import { Icono } from '../ui/Iconos.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useBloquearScroll } from '../../hooks/index.js';
import textos from '../../i18n/textos.js';
import './Header.css';

/**
 * A partir de cuántos píxeles de scroll el header se despega y flota.
 * 48px es poco más que el alto de una línea: alcanza para que el gesto se
 * sienta intencional y no se dispare con el rebote del scroll en iOS.
 */
const SCROLL_PARA_FLOTAR = 48;

export function Header({ transparente = false }) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [flotando, setFlotando] = useState(false);
  const { autenticado, usuario } = useAuth();
  const ubicacion = useLocation();

  useBloquearScroll(menuAbierto);

  // Listener de scroll pasivo: no cancela el gesto, así el scroll sigue siendo
  // fluido. El trabajo real lo hace CSS; acá solo se prende y apaga una clase.
  useEffect(() => {
    const alScrollear = () => setFlotando(window.scrollY > SCROLL_PARA_FLOTAR);

    alScrollear(); // por si la página carga ya scrolleada (volver atrás, un ancla)
    window.addEventListener('scroll', alScrollear, { passive: true });
    return () => window.removeEventListener('scroll', alScrollear);
  }, []);

  // El menú se cierra solo al navegar: si no, queda tapando la pantalla nueva.
  useEffect(() => {
    setMenuAbierto(false);
  }, [ubicacion.pathname]);

  const enlaces = [
    // El link de alta va en el header porque es el canal de captación de
    // estacionamientos: si solo está en el pie, no lo ve nadie.
    { a: '/registrar-estacionamiento', texto: textos.nav.tenesEstacionamiento },
    { a: '/sobre-nosotros', texto: textos.nav.sobreNosotros },
  ];

  return (
    <header
      className={[
        'sn-header',
        transparente ? 'sn-header--transparente' : '',
        flotando ? 'sn-header--flotante' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="sn-contenedor sn-header__interior">
        <Logo tam="md" />

        {/* Sin sn-solo-escritorio: esa utilidad aplica display:block y le mata
            el gap al flex del nav, dejando los links pegados. La propia clase
            sn-header__nav ya oculta en móvil y muestra en flex desde 900px. */}
        <nav className="sn-header__nav" aria-label="Navegación principal">
          {enlaces.map((e) => (
            <NavLink
              key={e.a}
              to={e.a}
              className={({ isActive }) =>
                `sn-header__link ${isActive ? 'sn-header__link--activo' : ''}`
              }
            >
              {e.texto}
            </NavLink>
          ))}

          {autenticado ? (
            <a
              href="/panel"
              target="_blank"
              rel="noopener noreferrer"
              className="sn-boton sn-boton--secundario sn-boton--sm"
            >
              <Icono nombre="tablero" tam={16} />
              {textos.nav.panel}
            </a>
          ) : (
            /* El panel es otra aplicación: se abre aparte para no perder la
               búsqueda que el usuario venía haciendo en esta pestaña. */
            <a
              href="/panel/ingresar"
              target="_blank"
              rel="noopener noreferrer"
              className="sn-header__link sn-header__link--cuenta"
            >
              <Icono nombre="usuario" tam={18} />
              {textos.nav.ingresar}
            </a>
          )}
        </nav>

        <button
          type="button"
          className="sn-header__hamburguesa sn-solo-movil"
          onClick={() => setMenuAbierto((v) => !v)}
          aria-expanded={menuAbierto}
          aria-controls="menu-movil"
          aria-label={menuAbierto ? textos.nav.cerrarMenu : textos.nav.menu}
        >
          <Icono nombre={menuAbierto ? 'equis' : 'menu'} tam={22} />
        </button>
      </div>

      {menuAbierto && (
        <div className="sn-header__movil" id="menu-movil">
          <nav aria-label="Navegación">
            {enlaces.map((e) => (
              <NavLink key={e.a} to={e.a} className="sn-header__movil-link">
                {e.texto}
              </NavLink>
            ))}

            <hr className="sn-separador" />

            {autenticado ? (
              <>
                <span className="sn-header__movil-usuario">
                  {usuario.nombre}
                  {usuario.parking && <small>{usuario.parking.nombre}</small>}
                </span>
                <a
                  href="/panel"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sn-boton sn-boton--primario sn-boton--bloque"
                >
                  <Icono nombre="tablero" tam={17} />
                  {textos.nav.panel}
                </a>
              </>
            ) : (
              <a
                href="/panel/ingresar"
                target="_blank"
                rel="noopener noreferrer"
                className="sn-boton sn-boton--secundario sn-boton--bloque"
              >
                <Icono nombre="usuario" tam={17} />
                {textos.nav.ingresar}
              </a>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

export default Header;
