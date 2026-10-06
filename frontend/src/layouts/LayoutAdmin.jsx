/**
 * Layout del panel administrativo.
 *
 * Protege las rutas, arma la navegación según el rol y ofrece la búsqueda
 * rápida por código o patente, que es lo que más se usa en la entrada.
 */
import { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import Logo from '../components/layout/Logo.jsx';
import { Icono } from '../components/ui/Iconos.jsx';
import { Cargando } from '../components/ui/Estado.jsx';
import BusquedaRapida from '../components/admin/BusquedaRapida.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useBloquearScroll, useEsMovil, usePedido, useRefrescoAutomatico } from '../hooks/index.js';
import { admin } from '../services/spotnear.service.js';
import useSesionPanel from '../hooks/useSesionPanel.js';
import { Modal } from '../components/ui/Varios.jsx';
import textos from '../i18n/textos.js';
import './LayoutAdmin.css';

/**
 * Secciones del panel. `roles` define quién la ve; sin `roles`, la ven todos.
 * El STAFF solo necesita reservas: el resto es configuración del negocio.
 */
const SECCIONES = [
  { a: '/panel', icono: 'tablero', texto: textos.admin.nav.dashboard, exacta: true },
  {
    a: '/panel/reservas',
    icono: 'ticket',
    texto: textos.admin.nav.reservas,
    // Reservas confirmadas que el dueño o el playero todavía no vio.
    contador: 'reservas',
  },
  {
    a: '/panel/mi-estacionamiento',
    icono: 'edificio',
    texto: textos.admin.nav.miEstacionamiento,
    roles: ['OWNER'],
  },
  {
    a: '/panel/estacionamientos',
    icono: 'edificio',
    texto: textos.admin.nav.estacionamientos,
    roles: ['SUPERADMIN'],
  },
  {
    a: '/panel/solicitudes',
    icono: 'gente',
    texto: textos.admin.nav.solicitudes,
    roles: ['SUPERADMIN'],
    // Lleva el contador de solicitudes sin revisar.
    contador: 'solicitudes',
  },
  { a: '/panel/tarifas', icono: 'dinero', texto: textos.admin.nav.tarifas, roles: ['SUPERADMIN', 'OWNER'] },
  { a: '/panel/equipo', icono: 'gente', texto: textos.admin.nav.equipo, roles: ['SUPERADMIN', 'OWNER'] },
  {
    a: '/panel/comisiones',
    icono: 'grafico',
    texto: textos.admin.nav.comisiones,
    // El dueño no ve comisiones: ve lo que le corresponde.
    textoPorRol: { OWNER: textos.admin.comisiones.tituloOwner },
    roles: ['SUPERADMIN', 'OWNER'],
  },
  {
    a: '/panel/catalogo-vehiculos',
    icono: 'auto',
    texto: textos.admin.nav.catalogoVehiculos,
    roles: ['SUPERADMIN'],
  },
  // Para los tres roles: cada uno ve y cambia solo lo suyo.
  { a: '/panel/cuenta', icono: 'usuario', texto: textos.admin.nav.miCuenta },
];

/** Dónde se recuerda si el menú lateral está contraído (por navegador). */
const CLAVE_MENU_COLAPSADO = 'spotnear.panel.menuColapsado';

function leerColapsado() {
  try {
    return localStorage.getItem(CLAVE_MENU_COLAPSADO) === '1';
  } catch {
    return false;
  }
}

export function LayoutAdmin() {
  const { usuario, cargando, autenticado, rol, salir } = useAuth();
  const ubicacion = useLocation();
  const navegar = useNavigate();
  const esMovil = useEsMovil(1024);

  const [menuAbierto, setMenuAbierto] = useState(false);
  useBloquearScroll(menuAbierto && esMovil);

  /**
   * Menú lateral contraído: solo íconos, con el nombre de cada sección como
   * tooltip. Es una preferencia de pantalla, así que vive en el navegador
   * (localStorage) y no en el servidor. En el celular no aplica: ahí el menú
   * es un panel que se abre y se cierra.
   */
  const [colapsado, setColapsado] = useState(leerColapsado);
  const colapsadoEfectivo = colapsado && !esMovil;
  const alternarColapsado = () => {
    setColapsado((v) => {
      try {
        localStorage.setItem(CLAVE_MENU_COLAPSADO, v ? '0' : '1');
      } catch {
        /* sin localStorage la preferencia dura lo que dura la pestaña */
      }
      return !v;
    });
  };

  /**
   * Cierre de sesión automático.
   *
   * `salir` avisa a las otras pestañas por defecto; cuando el disparador ES
   * otra pestaña se lo apaga, para no devolver el mensaje y hacer eco.
   */
  const cerrarPorSistema = useCallback(
    async (motivo) => {
      await salir({ avisarOtrasPestanas: motivo !== 'otraPestana' });
      navegar('/panel/ingresar', { replace: true, state: { motivo } });
    },
    [salir, navegar],
  );

  const { avisando, segundosRestantes, seguirConectado } = useSesionPanel({
    activo: autenticado,
    alCerrar: cerrarPorSistema,
  });

  // Navegar cierra el menú lateral en pantallas chicas.
  useEffect(() => {
    setMenuAbierto(false);
  }, [ubicacion.pathname]);

  /**
   * Solicitudes de alta sin revisar, para el contador del menú.
   *
   * Solo el SUPERADMIN las ve, así que para el resto ni se pide. Se refresca
   * al volver el foco y cada minuto, y además al cambiar de pantalla: así
   * cuando el SUPERADMIN aprueba o rechaza una y vuelve, el número ya bajó sin
   * que tenga que recargar.
   */
  const esSuperadmin = rol === 'SUPERADMIN';
  const { datos: datosPendientes, recargar: recargarPendientes } = usePedido(
    ({ signal }) => admin.solicitudes.pendientes({ signal }),
    [ubicacion.pathname],
    { inmediato: autenticado && esSuperadmin },
  );
  useRefrescoAutomatico(recargarPendientes, { activo: autenticado && esSuperadmin });
  const solicitudesPendientes = datosPendientes?.pendientes ?? 0;

  /**
   * Reservas nuevas para el dueño o el playero: confirmadas después de la
   * última vez que abrió la lista de Reservas (criterio en el README). Mismo
   * refresco que el de solicitudes. Al entrar a Reservas se marcan como vistas
   * y el contador vuelve a 0.
   */
  const tieneParking = autenticado && !esSuperadmin;
  const { datos: datosNuevas, recargar: recargarNuevas } = usePedido(
    ({ signal }) => admin.reservas.nuevas({ signal }),
    [ubicacion.pathname],
    { inmediato: tieneParking },
  );
  useRefrescoAutomatico(recargarNuevas, { activo: tieneParking });
  const reservasNuevas = datosNuevas?.nuevas ?? 0;

  useEffect(() => {
    if (!tieneParking || ubicacion.pathname !== '/panel/reservas') return;
    admin.reservas
      .marcarVistas()
      .then(recargarNuevas)
      .catch(() => {});
  }, [tieneParking, ubicacion.pathname, recargarNuevas]);

  const contadores = { solicitudes: solicitudesPendientes, reservas: reservasNuevas };
  const etiquetaContador = {
    solicitudes: (n) => `${n} ${n === 1 ? 'solicitud sin revisar' : 'solicitudes sin revisar'}`,
    reservas: textos.admin.nav.reservasNuevas,
  };

  if (cargando) return <Cargando texto="Verificando tu sesión..." />;

  if (!autenticado) {
    // Se recuerda a dónde quería ir para volver ahí después de ingresar.
    return <Navigate to="/panel/ingresar" replace state={{ desde: ubicacion.pathname }} />;
  }

  const secciones = SECCIONES.filter((s) => !s.roles || s.roles.includes(rol)).map((s) =>
    s.textoPorRol?.[rol] ? { ...s, texto: s.textoPorRol[rol] } : s,
  );

  const cerrarSesion = async () => {
    await salir();
    navegar('/panel/ingresar', { replace: true });
  };

  const avisoInactividad = (
    <Modal
      abierto={avisando}
      alCerrar={seguirConectado}
      titulo={textos.admin.sesion.avisoTitulo}
      ancho={420}
      pie={
        <>
          <button type="button" className="sn-boton sn-boton--secundario" onClick={cerrarSesion}>
            {textos.admin.sesion.avisoSalir}
          </button>
          <button type="button" className="sn-boton sn-boton--primario" onClick={seguirConectado}>
            {textos.admin.sesion.avisoSeguir}
          </button>
        </>
      }
    >
      <p className="sn-admin__aviso-sesion">
        {textos.admin.sesion.avisoTexto(segundosRestantes)}
      </p>
    </Modal>
  );

  return (
    <div className="sn-admin">
      {/* ─────────── Barra superior ─────────── */}
      <header className="sn-admin__topbar">
        <button
          type="button"
          className="sn-admin__hamburguesa"
          onClick={() => setMenuAbierto((v) => !v)}
          aria-expanded={menuAbierto}
          aria-label={menuAbierto ? textos.nav.cerrarMenu : textos.nav.menu}
        >
          <Icono nombre={menuAbierto ? 'equis' : 'menu'} tam={21} />
        </button>

        <Link to="/panel" className="sn-admin__logo">
          <Logo variante="claro" tam="sm" to={null} />
          <span className="sn-admin__logo-panel">Panel</span>
        </Link>

        <BusquedaRapida className="sn-admin__buscador" />

        <div className="sn-admin__usuario">
          <Link
            to="/panel/cuenta"
            className="sn-admin__usuario-datos"
            title={textos.admin.nav.miCuenta}
          >
            <strong>{usuario.nombre}</strong>
            <small>{usuario.parking?.nombre ?? textos.admin.roles[rol]}</small>
          </Link>
          <button
            type="button"
            className="sn-admin__salir"
            onClick={cerrarSesion}
            title={textos.nav.salir}
          >
            <Icono nombre="salir" tam={18} />
            <span className="sn-solo-lectores">{textos.nav.salir}</span>
          </button>
        </div>
      </header>

      <div className="sn-admin__cuerpo">
        {/* ─────────── Navegación lateral ─────────── */}
        <nav
          className={[
            'sn-admin__lateral',
            menuAbierto ? 'sn-admin__lateral--abierto' : '',
            colapsadoEfectivo ? 'sn-admin__lateral--colapsado' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-label="Secciones del panel"
        >
          <div>
            {/* Contraer / expandir (solo en pantallas grandes). */}
            <button
              type="button"
              className="sn-admin__colapsar"
              onClick={alternarColapsado}
              aria-expanded={!colapsado}
              title={colapsado ? textos.admin.nav.expandirMenu : textos.admin.nav.contraerMenu}
            >
              <Icono nombre={colapsado ? 'flechaDerecha' : 'flechaIzquierda'} tam={16} />
              <span className="sn-admin__link-texto">{textos.admin.nav.contraerMenu}</span>
            </button>

            <ul className="sn-admin__menu">
              {secciones.map((s) => {
                const n = s.contador ? contadores[s.contador] : 0;
                return (
                  <li key={s.a}>
                    <NavLink
                      to={s.a}
                      end={s.exacta}
                      // Contraído, el nombre de la sección queda como tooltip.
                      title={colapsadoEfectivo ? s.texto : undefined}
                      aria-label={colapsadoEfectivo ? s.texto : undefined}
                      className={({ isActive }) =>
                        `sn-admin__link ${isActive ? 'sn-admin__link--activo' : ''}`
                      }
                    >
                      <Icono nombre={s.icono} tam={19} />
                      <span className="sn-admin__link-texto">{s.texto}</span>
                      {/* El contador solo aparece si hay algo que revisar: un "0"
                          en el menú es ruido, no información. */}
                      {n > 0 && (
                        <span className="sn-admin__contador" aria-label={etiquetaContador[s.contador](n)}>
                          {n > 99 ? '99+' : n}
                        </span>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="sn-admin__lateral-pie">
            <span className="sn-admin__rol">{textos.admin.roles[rol]}</span>
            <Link
              to="/"
              className="sn-admin__ver-sitio"
              title={colapsadoEfectivo ? textos.admin.nav.verSitio : undefined}
            >
              <Icono nombre="externo" tam={14} />
              <span className="sn-admin__link-texto">{textos.admin.nav.verSitio}</span>
            </Link>
          </div>
        </nav>

        {menuAbierto && (
          <button
            type="button"
            className="sn-admin__velo"
            onClick={() => setMenuAbierto(false)}
            aria-label="Cerrar menú"
            tabIndex={-1}
          />
        )}

        {/* ─────────── Contenido ─────────── */}
        <main className="sn-admin__contenido">
          <Outlet />
        </main>

      {avisoInactividad}
      </div>
    </div>
  );
}

export default LayoutAdmin;
