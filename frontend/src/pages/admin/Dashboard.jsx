/**
 * Inicio del panel: el estado del estacionamiento de un vistazo.
 */
import { Link } from 'react-router-dom';
import { Icono } from '../../components/ui/Iconos.jsx';
import { Metrica } from '../../components/ui/Varios.jsx';
import { Cargando, ErrorCarga, Vacio } from '../../components/ui/Estado.jsx';
import GraficoBarras from '../../components/admin/GraficoBarras.jsx';
import TablaReservas from '../../components/admin/TablaReservas.jsx';
import ModalWhatsApp from '../../components/admin/ModalWhatsApp.jsx';
import { admin } from '../../services/spotnear.service.js';
import { usePedido, useTitulo } from '../../hooks/index.js';
import { useAccionesReserva } from '../../hooks/useAccionesReserva.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { precio as fmtPrecio, fechaLarga, hora } from '../../utils/formato.js';
import textos from '../../i18n/textos.js';
import './Dashboard.css';

const DIAS_GRAFICO = 14;

export function Dashboard() {
  const { usuario, esSuperadmin } = useAuth();
  useTitulo(textos.admin.nav.dashboard);

  const { datos, cargando, error, recargar } = usePedido(
    ({ signal }) => admin.reportes.dashboard({ dias: DIAS_GRAFICO }, { signal }),
    [],
  );

  const { procesando, ejecutar, whatsapp, abrirWhatsApp, abrirResumenDia, cerrarWhatsApp } =
    useAccionesReserva({ alActualizar: recargar });

  if (cargando) return <Cargando texto="Cargando tu panel..." />;
  if (error) return <ErrorCarga error={error} onReintentar={recargar} />;
  if (!datos) return null;

  const { hoy, mes, ocupacion, reservasHoy, proximasLlegadas, serie } = datos;

  return (
    <>
      <header className="sn-panel__cabecera">
        <div>
          <h1 className="sn-panel__titulo">
            {textos.admin.dashboard.titulo}, {usuario.nombre.split(' ')[0]}
          </h1>
          <p className="sn-panel__subtitulo">
            {usuario.parking?.nombre ?? 'Todos los estacionamientos de SpotNear'}
          </p>
        </div>

        <div className="sn-panel__acciones">
          <button
            type="button"
            className="sn-boton sn-boton--whatsapp"
            onClick={() => abrirResumenDia()}
          >
            <Icono nombre="whatsapp" tam={17} />
            {textos.admin.dashboard.compartirDia}
          </button>
          <Link to="/panel/reservas/nueva" className="sn-boton sn-boton--primario">
            <Icono nombre="mas" tam={17} />
            {textos.admin.reservas.nueva}
          </Link>
        </div>
      </header>

      {/* ── Métricas ── */}
      <div className="sn-dashboard__metricas">
        <Metrica
          icono="ticket"
          tono="marca"
          etiqueta={textos.admin.dashboard.reservasHoy}
          valor={hoy.cantidad}
          detalle={hoy.vehiculos > hoy.cantidad ? `${hoy.vehiculos} vehículos` : undefined}
        />
        <Metrica
          icono="dinero"
          tono="ok"
          etiqueta={textos.admin.dashboard.ingresosPrevistos}
          valor={fmtPrecio(hoy.ingresosPrevistos)}
          detalle={
            esSuperadmin
              ? `${textos.admin.dashboard.comisionSpotNear}: ${fmtPrecio(hoy.comision ?? 0)}`
              : `${textos.admin.dashboard.netoPrevisto}: ${fmtPrecio(hoy.netoPrevisto)}`
          }
        />
        <Metrica
          icono="auto"
          tono="info"
          etiqueta={textos.admin.dashboard.adentro}
          valor={hoy.enCurso}
          detalle={ocupacion ? `de ${ocupacion.capacidadTotal} lugares` : undefined}
        />
        <Metrica
          icono="grafico"
          etiqueta={textos.admin.dashboard.esteMes}
          valor={fmtPrecio(mes.ingresos)}
          detalle={`${mes.cantidad} ${mes.cantidad === 1 ? 'reserva' : 'reservas'}`}
        />
      </div>

      <div className="sn-dashboard__grilla">
        {/* ── Gráfico ── */}
        <section className="sn-panel__seccion sn-dashboard__grafico">
          <div className="sn-panel__seccion-cuerpo">
            <GraficoBarras
              serie={serie}
              titulo={`${textos.admin.dashboard.reservasPorDia} · ${textos.admin.dashboard.ultimosDias(DIAS_GRAFICO)}`}
            />
          </div>
        </section>

        {/* ── Ocupación ── */}
        {ocupacion && (
          <section className="sn-panel__seccion sn-dashboard__ocupacion">
            <div className="sn-panel__seccion-cuerpo">
              <h2 className="sn-dashboard__ocupacion-titulo">{textos.admin.dashboard.ocupacion}</h2>

              <div className="sn-ocupacion">
                <div
                  className="sn-ocupacion__barra"
                  role="meter"
                  aria-valuenow={ocupacion.adentro}
                  aria-valuemin={0}
                  aria-valuemax={ocupacion.capacidadTotal}
                  aria-label={textos.admin.dashboard.ocupacion}
                >
                  <span
                    className={`sn-ocupacion__relleno ${ocupacion.porcentaje >= 90 ? 'sn-ocupacion__relleno--lleno' : ''}`}
                    style={{ width: `${Math.min(100, ocupacion.porcentaje)}%` }}
                  />
                </div>

                <div className="sn-ocupacion__datos">
                  <span className="sn-ocupacion__numero">
                    {ocupacion.adentro}
                    <small>/{ocupacion.capacidadTotal}</small>
                  </span>
                  <span className="sn-ocupacion__etiqueta">
                    {ocupacion.porcentaje}% ocupado · {ocupacion.libres} libres ahora
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Próximas llegadas ── */}
        <section className="sn-panel__seccion sn-dashboard__llegadas">
          <div className="sn-panel__seccion-cabecera">
            <h2 className="sn-panel__seccion-titulo">{textos.admin.dashboard.proximasLlegadas}</h2>
          </div>

          {proximasLlegadas.length === 0 ? (
            <Vacio icono="reloj" titulo={textos.admin.dashboard.sinLlegadas} />
          ) : (
            <ul className="sn-llegadas">
              {proximasLlegadas.map((r) => (
                <li key={r.id} className="sn-llegada">
                  <span className="sn-llegada__hora">{hora(r.inicio)}</span>
                  <div className="sn-llegada__datos">
                    <Link to={`/panel/reservas/${r.id}`} className="sn-llegada__nombre">
                      {r.cliente.nombre} {r.cliente.apellido}
                    </Link>
                    <span className="sn-llegada__detalle">
                      {r.codigo} · {r.vehiculo.patente}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="sn-boton sn-boton--primario sn-boton--sm"
                    onClick={() => ejecutar(r, 'check-in')}
                    disabled={procesando === r.id}
                  >
                    <Icono nombre="llegada" tam={15} />
                    {textos.admin.reservas.acciones.checkIn}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── Reservas de hoy ── */}
      <section className="sn-panel__seccion">
        <div className="sn-panel__seccion-cabecera">
          <h2 className="sn-panel__seccion-titulo">
            {textos.admin.dashboard.hoy} · {fechaLarga(new Date())}
          </h2>
          <Link to="/panel/reservas" className="sn-link">
            {textos.admin.dashboard.verTodas}
          </Link>
        </div>

        {reservasHoy.length === 0 ? (
          <Vacio
            icono="ticket"
            titulo={textos.admin.dashboard.sinReservasHoy}
            accion={
              <Link to="/panel/reservas/nueva" className="sn-boton sn-boton--secundario">
                <Icono nombre="mas" tam={16} />
                {textos.admin.reservas.nueva}
              </Link>
            }
          />
        ) : (
          <TablaReservas
            reservas={reservasHoy}
            onAccion={ejecutar}
            onWhatsApp={(r) => abrirWhatsApp(r, 'grupo')}
            procesando={procesando}
            mostrarParking={esSuperadmin}
          />
        )}
      </section>

      <ModalWhatsApp
        abierto={whatsapp.abierto}
        alCerrar={cerrarWhatsApp}
        titulo={whatsapp.titulo}
        mensaje={whatsapp.mensaje}
        link={whatsapp.link}
        cargando={whatsapp.cargando}
      />
    </>
  );
}

export default Dashboard;
