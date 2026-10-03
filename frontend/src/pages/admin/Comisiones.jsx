/**
 * Reporte de comisiones.
 *
 * El SUPERADMIN ve lo que factura la plataforma; el OWNER ve su facturación y
 * su neto. La diferencia la aplica el backend: acá solo se muestra lo que llega.
 */
import { useState, useMemo } from 'react';
import { Icono } from '../../components/ui/Iconos.jsx';
import { Cargando, ErrorCarga, Vacio } from '../../components/ui/Estado.jsx';
import { Metrica } from '../../components/ui/Varios.jsx';
import { admin } from '../../services/spotnear.service.js';
import { usePedido, useTitulo } from '../../hooks/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { precio as fmtPrecio, paraInputDate } from '../../utils/formato.js';
import textos from '../../i18n/textos.js';
import './Comisiones.css';

/** Períodos de un toque: son los que se consultan siempre. */
function rangosRapidos() {
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const inicioMesPasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const finMesPasado = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
  const hace30 = new Date(hoy.getTime() - 30 * 86_400_000);

  return [
    { id: 'mes', etiqueta: 'Este mes', desde: inicioMes, hasta: hoy },
    { id: 'mes-pasado', etiqueta: 'Mes pasado', desde: inicioMesPasado, hasta: finMesPasado },
    { id: '30', etiqueta: 'Últimos 30 días', desde: hace30, hasta: hoy },
    { id: 'anio', etiqueta: 'Este año', desde: new Date(hoy.getFullYear(), 0, 1), hasta: hoy },
  ];
}

export function Comisiones() {
  const { esSuperadmin } = useAuth();
  const toast = useToast();
  useTitulo(esSuperadmin ? textos.admin.comisiones.titulo : textos.admin.comisiones.tituloOwner);

  const rangos = useMemo(rangosRapidos, []);
  const [rango, setRango] = useState(rangos[0]);
  const [agrupar, setAgrupar] = useState('PARKING');
  const [exportando, setExportando] = useState(false);

  const consulta = useMemo(
    () => ({
      desde: paraInputDate(rango.desde),
      hasta: paraInputDate(rango.hasta),
      agrupar,
    }),
    [rango, agrupar],
  );

  const { datos, cargando, error, recargar } = usePedido(
    ({ signal }) => admin.reportes.comisiones(consulta, { signal }),
    [JSON.stringify(consulta)],
  );

  const exportar = async () => {
    setExportando(true);
    try {
      await admin.reportes.exportarComisiones({ desde: consulta.desde, hasta: consulta.hasta });
      toast.ok('Descarga iniciada');
    } catch (e) {
      toast.error(e.message ?? textos.errores.generico);
    } finally {
      setExportando(false);
    }
  };

  const filas = datos?.filas ?? [];
  const totales = datos?.totales;

  return (
    <>
      <header className="sn-panel__cabecera">
        <div>
          <h1 className="sn-panel__titulo">
            {esSuperadmin ? textos.admin.comisiones.titulo : textos.admin.comisiones.tituloOwner}
          </h1>
          <p className="sn-panel__subtitulo">
            {esSuperadmin ? textos.admin.comisiones.subtitulo : textos.admin.comisiones.subtituloOwner}{' '}
            <em className="sn-silencio">{textos.admin.comisiones.alcance}</em>
          </p>
        </div>
        <div className="sn-panel__acciones">
          <button
            type="button"
            className="sn-boton sn-boton--secundario"
            onClick={exportar}
            disabled={exportando}
          >
            {exportando ? (
              <span className="sn-spinner" style={{ width: 16, height: 16 }} aria-hidden="true" />
            ) : (
              <Icono nombre="descargar" tam={17} />
            )}
            {textos.admin.comisiones.exportar}
          </button>
        </div>
      </header>

      {/* ── Período ── */}
      <div className="sn-comisiones__controles">
        <div className="sn-comisiones__rangos" role="group" aria-label={textos.admin.comisiones.periodo}>
          {rangos.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`sn-chip ${rango.id === r.id ? 'sn-chip--activo' : ''}`}
              onClick={() => setRango(r)}
            >
              {r.etiqueta}
            </button>
          ))}
        </div>

        {esSuperadmin && (
          <label className="sn-comisiones__agrupar">
            <span>{textos.admin.comisiones.agrupar}</span>
            <select
              className="sn-select"
              value={agrupar}
              onChange={(e) => setAgrupar(e.target.value)}
            >
              <option value="PARKING">{textos.admin.comisiones.porParking}</option>
              <option value="MES">{textos.admin.comisiones.porMes}</option>
            </select>
          </label>
        )}
      </div>

      {cargando && <Cargando />}
      {!cargando && error && <ErrorCarga error={error} onReintentar={recargar} />}

      {!cargando && !error && (
        <>
          {/* ── Totales ── */}
          {totales && (
            <div className="sn-comisiones__totales">
              <Metrica
                icono="ticket"
                etiqueta={textos.admin.comisiones.reservas}
                valor={totales.cantidad}
              />
              <Metrica
                icono="dinero"
                etiqueta={textos.admin.comisiones.facturado}
                valor={fmtPrecio(totales.precioTotal)}
              />
              {esSuperadmin && totales.montoComision !== undefined && (
                <Metrica
                  icono="grafico"
                  tono="marca"
                  etiqueta={textos.admin.comisiones.comision}
                  valor={fmtPrecio(totales.montoComision)}
                  detalle={
                    totales.precioTotal > 0
                      ? `${((totales.montoComision / totales.precioTotal) * 100).toFixed(1)}% efectivo`
                      : undefined
                  }
                />
              )}
              <Metrica
                icono="edificio"
                tono="ok"
                etiqueta={textos.admin.comisiones.neto}
                valor={fmtPrecio(totales.montoNeto)}
              />
            </div>
          )}

          {/* ── Detalle ── */}
          <section className="sn-panel__seccion">
            {filas.length === 0 ? (
              <Vacio
                icono="grafico"
                titulo={textos.admin.comisiones.sinDatos}
                texto="Probá con otro período."
              />
            ) : (
              <div className="sn-tabla-scroll">
                <table className="sn-tabla">
                  <thead>
                    <tr>
                      <th>
                        {agrupar === 'MES'
                          ? textos.admin.comisiones.periodo
                          : textos.admin.comisiones.estacionamiento}
                      </th>
                      <th className="sn-tabla__num">{textos.admin.comisiones.reservas}</th>
                      <th className="sn-tabla__num">{textos.admin.comisiones.facturado}</th>
                      {esSuperadmin && (
                        <th className="sn-tabla__num">{textos.admin.comisiones.comision}</th>
                      )}
                      <th className="sn-tabla__num">{textos.admin.comisiones.neto}</th>
                      <th className="sn-comisiones__col-barra" aria-label="Participación" />
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => {
                      const participacion =
                        totales?.precioTotal > 0
                          ? Math.round((f.precioTotal / totales.precioTotal) * 100)
                          : 0;
                      return (
                        <tr key={f.clave} className={f.parkingEliminado ? 'sn-fila--historica' : ''}>
                          <td>
                            <strong>{f.etiqueta}</strong>
                            {/* Las reservas de un estacionamiento eliminado se
                                conservan para la contabilidad, pero la fila
                                tiene que decir que ya no opera. */}
                            {f.parkingEliminado && (
                              <span className="sn-badge sn-badge--neutro sn-badge--contador">
                                {textos.admin.comisiones.parkingEliminado}
                              </span>
                            )}
                          </td>
                          <td className="sn-tabla__num">{f.cantidad}</td>
                          <td className="sn-tabla__num sn-precio">{fmtPrecio(f.precioTotal)}</td>
                          {esSuperadmin && (
                            <td className="sn-tabla__num sn-comisiones__comision">
                              {fmtPrecio(f.montoComision ?? 0)}
                            </td>
                          )}
                          <td className="sn-tabla__num">{fmtPrecio(f.montoNeto)}</td>
                          <td className="sn-comisiones__col-barra">
                            {/* Barra de participación: hace evidente de un vistazo
                                qué estacionamiento aporta más facturación. */}
                            <span className="sn-comisiones__barra" title={`${participacion}% del total`}>
                              <span
                                className="sn-comisiones__barra-relleno"
                                style={{ width: `${participacion}%` }}
                              />
                            </span>
                            <span className="sn-comisiones__porcentaje">{participacion}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {totales && (
                    <tfoot>
                      <tr>
                        <th>{textos.admin.comisiones.totales}</th>
                        <td className="sn-tabla__num">{totales.cantidad}</td>
                        <td className="sn-tabla__num sn-precio">{fmtPrecio(totales.precioTotal)}</td>
                        {esSuperadmin && (
                          <td className="sn-tabla__num sn-comisiones__comision">
                            {fmtPrecio(totales.montoComision ?? 0)}
                          </td>
                        )}
                        <td className="sn-tabla__num sn-precio">{fmtPrecio(totales.montoNeto)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

export default Comisiones;
