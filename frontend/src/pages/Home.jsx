/**
 * Home pública.
 *
 * Es la pantalla que más se comparte, así que tiene que dejar claro en cinco
 * segundos qué se puede hacer acá: buscar un lugar y reservarlo.
 */
import { Link } from 'react-router-dom';
import TarjetaBusqueda from '../components/busqueda/TarjetaBusqueda.jsx';
import { Icono } from '../components/ui/Iconos.jsx';
import { useTitulo } from '../hooks/index.js';
import { DURACION_POR_DEFECTO_HORAS, urlBusqueda } from '../hooks/useBusqueda.js';
import { LUGARES } from '../components/busqueda/lugares.js';
import textos from '../i18n/textos.js';
import './Home.css';

/** Barrios donde ya hay estacionamientos cargados. */
const ZONAS = [
  'Villa Crespo',
  'Palermo',
  'Chacarita',
  'Almagro',
  'Microcentro',
  'Recoleta',
  'Caballito',
  'Belgrano',
];

const ICONOS_PASOS = ['lupa', 'ticket', 'estacionamiento'];

export function Home() {
  useTitulo(null);

  return (
    <>
      {/* ───────────────── Hero ───────────────── */}
      <section className="sn-hero">
        <div className="sn-contenedor sn-hero__interior">
          <div className="sn-hero__texto">
            <h1 className="sn-hero__titulo">{textos.home.titulo}</h1>
            {/* <p className="sn-hero__subtitulo">{textos.home.subtitulo}</p> */}
            <TarjetaBusqueda className="sn-hero__buscador" />
          </div>

          <div className="sn-hero__imagen">
            <img
              src="/assets/hero.jpg"
              alt={textos.home.heroAlt}
              width={1280}
              height={854}
              fetchpriority="high"
            />
          </div>
        </div>
      </section>

      {/* ───────────────── Señales de confianza ───────────────── */}
      <section className="sn-confianza">
        <div className="sn-contenedor sn-confianza__grilla">
          {textos.home.confianza.map((c, i) => (
            <div key={c.titulo} className="sn-confianza__item">
              <span className="sn-confianza__icono">
                <Icono nombre={['escudo', 'dinero', 'ticket'][i]} tam={20} />
              </span>
              <div>
                <p className="sn-confianza__titulo">{c.titulo}</p>
                <p className="sn-confianza__texto">{c.texto}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────── Cómo funciona ───────────────── */}
      <section className="sn-seccion" id="como-funciona">
        <div className="sn-contenedor">
          <header className="sn-seccion__cabecera">
            <h2>{textos.home.comoFunciona}</h2>
            <p>{textos.home.comoFuncionaSubtitulo}</p>
          </header>

          <ol className="sn-pasos">
            {textos.home.pasos.map((paso, i) => (
              <li key={paso.titulo} className="sn-paso">
                <span className="sn-paso__numero" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="sn-paso__icono">
                  <Icono nombre={ICONOS_PASOS[i]} tam={26} grosor={1.5} />
                </span>
                <h3 className="sn-paso__titulo">{paso.titulo}</h3>
                <p className="sn-paso__texto">{paso.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───────────────── Zonas ───────────────── */}
      <section className="sn-seccion sn-zonas">
        <div className="sn-contenedor">
          <header className="sn-seccion__cabecera">
            <h2>{textos.home.zonas}</h2>
            <p>{textos.home.zonasSubtitulo}</p>
          </header>

          <ul className="sn-zonas__lista">
            {ZONAS.map((zona) => {
              const lugar = LUGARES.find((l) => l.nombre === zona);
              if (!lugar) return null;
              const inicio = new Date(Date.now() + 3_600_000);
              inicio.setMinutes(0, 0, 0);
              return (
                <li key={zona}>
                  <Link
                    to={urlBusqueda({
                      destino: lugar,
                      inicio,
                      fin: new Date(inicio.getTime() + DURACION_POR_DEFECTO_HORAS * 3_600_000),
                    })}
                    className="sn-zona"
                  >
                    <Icono nombre="pin" tam={15} />
                    {zona}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ───────────────── Para estacionamientos ───────────────── */}
      <section className="sn-cta">
        <div className="sn-contenedor sn-cta__interior">
          <div>
            <h2 className="sn-cta__titulo">¿Tenés un estacionamiento?</h2>
            <p className="sn-cta__texto">
              Sumate a SpotNear y recibí reservas organizadas, con los datos del cliente y del
              vehículo ya cargados. Tenés tu propio panel para ver y gestionar todo.
            </p>
          </div>
          <Link to="/sobre-nosotros" className="sn-boton sn-boton--primario sn-boton--lg">
            Quiero sumar mi estacionamiento
            <Icono nombre="flechaDerecha" tam={17} />
          </Link>
        </div>
      </section>
    </>
  );
}

export default Home;
