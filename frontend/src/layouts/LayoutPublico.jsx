/**
 * Layout del sitio público: header + contenido + footer.
 */
import { Outlet, ScrollRestoration } from 'react-router-dom';
import Header from '../components/layout/Header.jsx';
import Footer from '../components/layout/Footer.jsx';
import './LayoutPublico.css';

/**
 * @param {object} props
 * @param {boolean} [props.sinFooter] La pantalla de resultados ocupa todo el alto
 * @param {boolean} [props.sinHeader] Para pantallas con su propio encabezado
 */
export function LayoutPublico({ sinFooter = false, sinHeader = false }) {
  return (
    <div className={`sn-layout ${sinFooter ? 'sn-layout--completo' : ''}`}>
      <a href="#contenido" className="sn-saltar">
        Saltar al contenido
      </a>

      {/* Resultados trae su propia barra de búsqueda con el logo: dos
          encabezados encimados no aportan nada. */}
      {!sinHeader && <Header />}

      <main id="contenido" className="sn-layout__main">
        <Outlet />
      </main>

      {!sinFooter && <Footer />}

      {/* Devuelve el scroll al tope al navegar, salvo al volver con el historial */}
      <ScrollRestoration />
    </div>
  );
}

export default LayoutPublico;
