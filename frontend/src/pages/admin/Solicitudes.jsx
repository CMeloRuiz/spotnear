/**
 * Solicitudes de alta (solo SUPERADMIN).
 *
 * Bandeja de entrada de los estacionamientos que se registraron por su cuenta
 * desde /registrar-estacionamiento. Mientras están acá en PENDIENTE no aparecen
 * en ninguna búsqueda y el dueño no puede entrar al panel: aprobar es lo que
 * enciende las dos cosas.
 *
 * Rechazar no borra nada. Queda el registro, con su motivo, para poder
 * revisarlo después o revertirlo.
 */
import { useState } from 'react';
import { Icono, ICONO_SERVICIO } from '../../components/ui/Iconos.jsx';
import { Cargando, ErrorCarga, Vacio } from '../../components/ui/Estado.jsx';
import { Modal, Aviso } from '../../components/ui/Varios.jsx';
import { CampoTexto } from '../../components/ui/Campo.jsx';
import { admin } from '../../services/spotnear.service.js';
import { usePedido, useTitulo } from '../../hooks/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { fechaHora } from '../../utils/formato.js';
import { resumenHorario } from '../../utils/horarios.js';
import textos from '../../i18n/textos.js';
import './Solicitudes.css';

const t = textos.admin.solicitudes;

const FILTROS = [
  { id: 'PENDIENTE_APROBACION', etiqueta: t.pendientes },
  { id: 'ACTIVO', etiqueta: t.aprobadas },
  { id: 'RECHAZADO', etiqueta: t.rechazadas },
  { id: 'TODAS', etiqueta: t.todas },
];

const BADGE_ESTADO = {
  PENDIENTE_APROBACION: { tono: 'aviso', texto: 'Pendiente' },
  ACTIVO: { tono: 'ok', texto: 'Aprobada' },
  RECHAZADO: { tono: 'error', texto: 'Rechazada' },
};

export function Solicitudes() {
  const { esSuperadmin } = useAuth();
  const toast = useToast();
  useTitulo(t.titulo);

  const [filtro, setFiltro] = useState('PENDIENTE_APROBACION');
  const [rechazando, setRechazando] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [procesando, setProcesando] = useState(null);

  const { datos, cargando, error, recargar } = usePedido(
    ({ signal }) => admin.solicitudes.listar({ estado: filtro }, { signal }),
    [filtro],
  );

  const solicitudes = datos?.solicitudes ?? [];

  if (!esSuperadmin) {
    return (
      <Vacio
        icono="candado"
        titulo={textos.errores.sinPermiso}
        texto="Esta sección es exclusiva del administrador de la plataforma."
      />
    );
  }

  const aprobar = async (s) => {
    if (!window.confirm(t.confirmarAprobar)) return;

    setProcesando(s.id);
    try {
      await admin.solicitudes.aprobar(s.id, { publicar: true });
      toast.ok(t.aprobada);
      recargar();
    } catch (e) {
      toast.error(e.message ?? textos.errores.generico);
    } finally {
      setProcesando(null);
    }
  };

  const confirmarRechazo = async () => {
    setProcesando(rechazando.id);
    try {
      await admin.solicitudes.rechazar(rechazando.id, { motivo: motivo.trim() || undefined });
      toast.ok(t.rechazada);
      setRechazando(null);
      setMotivo('');
      recargar();
    } catch (e) {
      toast.error(e.message ?? textos.errores.generico);
    } finally {
      setProcesando(null);
    }
  };

  return (
    <>
      <header className="sn-panel__cabecera">
        <div>
          <h1 className="sn-panel__titulo">
            {t.titulo}
            {datos?.pendientes > 0 && (
              <span className="sn-solicitudes__contador">{datos.pendientes}</span>
            )}
          </h1>
          <p className="sn-panel__subtitulo">{t.subtitulo}</p>
        </div>
      </header>

      <div className="sn-solicitudes__filtros" role="tablist" aria-label="Estado de la solicitud">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filtro === f.id}
            className={`sn-chip ${filtro === f.id ? 'sn-chip--activo' : ''}`}
            onClick={() => setFiltro(f.id)}
          >
            {f.etiqueta}
          </button>
        ))}
      </div>

      {cargando && <Cargando />}
      {!cargando && error && <ErrorCarga error={error} onReintentar={recargar} />}

      {!cargando && !error && solicitudes.length === 0 && (
        <section className="sn-panel__seccion">
          <Vacio icono="edificio" titulo={t.sinSolicitudes} texto={t.sinSolicitudesTexto} />
        </section>
      )}

      {solicitudes.length > 0 && (
        <ul className="sn-solicitudes">
          {solicitudes.map((s) => {
            const badge = BADGE_ESTADO[s.estado] ?? BADGE_ESTADO.PENDIENTE_APROBACION;
            const pendiente = s.estado === 'PENDIENTE_APROBACION';

            return (
              <li key={s.id} className="sn-solicitud">
                <header className="sn-solicitud__cabecera">
                  <div>
                    <h2 className="sn-solicitud__nombre">{s.nombre}</h2>
                    <p className="sn-solicitud__direccion">
                      <Icono nombre="pin" tam={14} />
                      {s.direccion}
                      {s.barrio && `, ${s.barrio}`}
                    </p>
                  </div>
                  <span className={`sn-badge sn-badge--${badge.tono}`}>{badge.texto}</span>
                </header>

                {s.descripcion && <p className="sn-solicitud__descripcion">{s.descripcion}</p>}

                <dl className="sn-solicitud__datos">
                  <div>
                    <dt>{t.duenio}</dt>
                    <dd>
                      {s.duenio ? (
                        <>
                          {s.duenio.nombre}
                          <a href={`mailto:${s.duenio.email}`}>{s.duenio.email}</a>
                          {s.duenio.telefono && <span>{s.duenio.telefono}</span>}
                        </>
                      ) : (
                        <span className="sn-solicitud__sin-dato">Sin usuario asociado</span>
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>{t.capacidad}</dt>
                    <dd>
                      {textos.parking.lugares(s.capacidadTotal)}
                      <span>{s.cubierto ? 'Cubierto' : 'Descubierto'}</span>
                      <span>
                        {s.tiposVehiculo
                          .map((v) => textos.parking.tiposVehiculo[v] ?? v)
                          .join(' · ')}
                      </span>
                    </dd>
                  </div>

                  <div>
                    <dt>{t.recibida}</dt>
                    <dd>
                      {fechaHora(s.creadaEn)}
                      <span>{resumenHorario(s)}</span>
                      <span>Comisión {s.comisionPorcentaje}%</span>
                    </dd>
                  </div>
                </dl>

                {/* Las fotos son buena parte del criterio para aprobar:
                    conviene verlas sin salir de la bandeja. */}
                {s.fotos?.length > 0 && (
                  <ul className="sn-solicitud__fotos">
                    {s.fotos.map((f, i) => (
                      <li key={f.id ?? f.url}>
                        <a href={f.url} target="_blank" rel="noopener noreferrer">
                          <img src={f.url} alt={f.alt || `${s.nombre} — foto ${i + 1}`} loading="lazy" />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}

                {s.servicios?.length > 0 && (
                  <ul className="sn-solicitud__servicios">
                    {s.servicios.map((serv) => (
                      <li key={serv}>
                        <Icono nombre={ICONO_SERVICIO[serv] ?? 'check'} tam={14} />
                        {textos.parking.servicios[serv] ?? serv}
                      </li>
                    ))}
                  </ul>
                )}

                {s.estado === 'RECHAZADO' && s.motivoRechazo && (
                  <Aviso tipo="error">
                    <strong>Motivo del rechazo:</strong> {s.motivoRechazo}
                  </Aviso>
                )}

                {pendiente && (
                  <>
                    <Aviso tipo="info">{t.recordatorioTarifas}</Aviso>

                    <div className="sn-solicitud__acciones">
                      <button
                        type="button"
                        className="sn-boton sn-boton--secundario"
                        onClick={() => {
                          setRechazando(s);
                          setMotivo('');
                        }}
                        disabled={procesando === s.id}
                      >
                        {t.rechazar}
                      </button>
                      <button
                        type="button"
                        className="sn-boton sn-boton--primario"
                        onClick={() => aprobar(s)}
                        disabled={procesando === s.id}
                      >
                        <Icono nombre="check" tam={16} />
                        {t.aprobar}
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        abierto={rechazando !== null}
        alCerrar={() => setRechazando(null)}
        titulo={rechazando ? `Rechazar "${rechazando.nombre}"` : ''}
        pie={
          <>
            <button
              type="button"
              className="sn-boton sn-boton--secundario"
              onClick={() => setRechazando(null)}
            >
              {textos.comunes.cancelar}
            </button>
            <button
              type="button"
              className="sn-boton sn-boton--peligro"
              onClick={confirmarRechazo}
              disabled={procesando !== null}
            >
              {t.rechazar}
            </button>
          </>
        }
      >
        <CampoTexto
          label={t.motivoRechazo}
          opcional
          rows={4}
          ayuda={t.motivoAyuda}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </Modal>
    </>
  );
}

export default Solicitudes;
