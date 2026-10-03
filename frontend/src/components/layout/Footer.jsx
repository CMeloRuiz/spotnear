/**
 * Pie del sitio público.
 */
import { Link } from 'react-router-dom';
import Logo from './Logo.jsx';
import { Icono } from '../ui/Iconos.jsx';
import textos from '../../i18n/textos.js';
import './Footer.css';

const WHATSAPP = import.meta.env.VITE_WHATSAPP_SOPORTE || '';

export function Footer() {
  const anio = new Date().getFullYear();

  return (
    <footer className="sn-footer">
      <div className="sn-contenedor sn-footer__interior">
        <div className="sn-footer__marca">
          {/* Fondo oscuro: acá va la variante original del logo, con el texto blanco */}
          <Logo variante="claro" tam="md" />
          <p className="sn-footer__tagline">{textos.marca.descripcion}</p>
          <p className="sn-footer__lugar">
            <Icono nombre="pin" tam={14} />
            {textos.footer.hechoEn}
          </p>
        </div>

        <nav className="sn-footer__columnas" aria-label="Enlaces del pie">
          <div className="sn-footer__columna">
            <h3 className="sn-footer__titulo">{textos.footer.producto}</h3>
            <Link to="/">{textos.nav.inicio}</Link>
            <Link to="/sobre-nosotros">{textos.footer.paraEstacionamientos}</Link>
            <Link to="/registrar-estacionamiento">{textos.footer.registrarEstacionamiento}</Link>
            <Link to="/panel/ingresar">{textos.nav.ingresar}</Link>
          </div>

          <div className="sn-footer__columna">
            <h3 className="sn-footer__titulo">{textos.footer.empresa}</h3>
            <Link to="/sobre-nosotros">{textos.footer.sobreNosotros}</Link>
            {WHATSAPP && (
              <a
                href={`https://wa.me/${WHATSAPP.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {textos.footer.contacto}
                <Icono nombre="externo" tam={12} />
              </a>
            )}
          </div>

          <div className="sn-footer__columna">
            <h3 className="sn-footer__titulo">{textos.footer.legal}</h3>
            <Link to="/terminos">{textos.footer.terminos}</Link>
            <Link to="/privacidad">{textos.footer.privacidad}</Link>
          </div>
        </nav>
      </div>

      <div className="sn-contenedor">
        <div className="sn-footer__abajo">
          <span>{textos.footer.derechos(anio)}</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
