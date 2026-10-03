/**
 * Equipo: los usuarios que entran al panel.
 */
import { useState } from 'react';
import { Icono } from '../../components/ui/Iconos.jsx';
import { Cargando, ErrorCarga, Vacio } from '../../components/ui/Estado.jsx';
import { Modal, Aviso } from '../../components/ui/Varios.jsx';
import { Campo, CampoSelect } from '../../components/ui/Campo.jsx';
import { admin } from '../../services/spotnear.service.js';
import { usePedido, useTitulo } from '../../hooks/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { fechaHora } from '../../utils/formato.js';
import { esEmailValido } from '../../utils/validaciones.js';
import textos from '../../i18n/textos.js';
import './Equipo.css';

const FORM_VACIO = { nombre: '', email: '', password: '', telefono: '', role: 'STAFF', parkingId: '' };

export function Equipo() {
  const toast = useToast();
  const { usuario, esSuperadmin } = useAuth();
  useTitulo(textos.admin.equipo.titulo);

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  // Quién está a punto de eliminarse; null = modal cerrado.
  const [aEliminar, setAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const { datos, cargando, error, recargar } = usePedido(
    ({ signal }) => admin.equipo.listar({ incluirInactivos: true }, { signal }),
    [],
  );

  const { datos: datosParkings } = usePedido(
    ({ signal }) => (esSuperadmin ? admin.parkings.listar({}, { signal }) : Promise.resolve(null)),
    [esSuperadmin],
  );

  const usuarios = datos?.usuarios ?? [];
  const parkings = datosParkings?.parkings ?? [];

  /** Un OWNER solo puede crear STAFF; el SUPERADMIN, cualquier rol. */
  const rolesPosibles = esSuperadmin ? ['SUPERADMIN', 'OWNER', 'STAFF'] : ['STAFF'];

  const abrirNuevo = () => {
    setForm({ ...FORM_VACIO, parkingId: usuario.parkingId ?? '' });
    setErrores({});
    setModal(true);
  };

  const guardar = async () => {
    const nuevos = {};
    if (!form.nombre.trim()) nuevos.nombre = textos.errores.campoObligatorio;
    if (!form.email.trim()) nuevos.email = textos.errores.campoObligatorio;
    else if (!esEmailValido(form.email)) nuevos.email = textos.errores.emailInvalido;
    if (form.password.length < 8) nuevos.password = textos.errores.passwordCorta;
    if (form.role !== 'SUPERADMIN' && esSuperadmin && !form.parkingId) {
      nuevos.parkingId = textos.errores.campoObligatorio;
    }

    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    setGuardando(true);
    try {
      await admin.equipo.crear({
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        password: form.password,
        telefono: form.telefono.trim() || undefined,
        role: form.role,
        parkingId: form.role === 'SUPERADMIN' ? undefined : form.parkingId || undefined,
      });
      toast.ok('Usuario creado');
      setModal(false);
      recargar();
    } catch (e) {
      toast.error(e.message ?? textos.errores.generico);
      const deCampo = e.erroresDeCampo ?? {};
      if (Object.keys(deCampo).length > 0) setErrores(deCampo);
    } finally {
      setGuardando(false);
    }
  };

  /**
   * Borra el usuario de verdad, distinto de darlo de baja.
   *
   * Los primeros candidatos son los que quedaron inactivos porque se eliminó su
   * estacionamiento: ya no tienen dónde operar. El backend conserva el
   * historial guardando su nombre en las reservas que haya cargado.
   */
  const eliminar = async () => {
    if (!aEliminar) return;
    setEliminando(true);
    try {
      const r = await admin.equipo.eliminar(aEliminar.id);
      setAEliminar(null);
      toast.ok(r?.mensaje ?? `${aEliminar.nombre} se eliminó.`);
      recargar();
    } catch (e) {
      toast.error(e.message ?? textos.errores.generico);
    } finally {
      setEliminando(false);
    }
  };

  const alternarActivo = async (u) => {
    try {
      if (u.activo) {
        if (!window.confirm(textos.admin.equipo.confirmarBaja)) return;
        await admin.equipo.darDeBaja(u.id);
        toast.ok(`${u.nombre} quedó dado de baja`);
      } else {
        await admin.equipo.editar(u.id, { activo: true });
        toast.ok(`${u.nombre} está activo de nuevo`);
      }
      recargar();
    } catch (e) {
      toast.error(e.message ?? textos.errores.generico);
    }
  };

  return (
    <>
      <header className="sn-panel__cabecera">
        <div>
          <h1 className="sn-panel__titulo">{textos.admin.equipo.titulo}</h1>
          <p className="sn-panel__subtitulo">{textos.admin.equipo.subtitulo}</p>
        </div>
        <div className="sn-panel__acciones">
          <button type="button" className="sn-boton sn-boton--primario" onClick={abrirNuevo}>
            <Icono nombre="mas" tam={17} />
            {textos.admin.equipo.nuevo}
          </button>
        </div>
      </header>

      <section className="sn-panel__seccion">
        {cargando && <Cargando />}
        {!cargando && error && <ErrorCarga error={error} onReintentar={recargar} />}

        {!cargando && !error && usuarios.length === 0 && (
          <Vacio icono="gente" titulo="Todavía no hay nadie más en el equipo" />
        )}

        {!cargando && !error && usuarios.length > 0 && (
          <div className="sn-tabla-scroll">
            <table className="sn-tabla">
              <thead>
                <tr>
                  <th>{textos.admin.equipo.nombre}</th>
                  <th>{textos.admin.equipo.email}</th>
                  <th>{textos.admin.equipo.rol}</th>
                  {esSuperadmin && <th>Estacionamiento</th>}
                  <th>{textos.admin.equipo.ultimoLogin}</th>
                  <th>{textos.admin.equipo.estado}</th>
                  <th aria-label={textos.admin.reservas.columnas.acciones} />
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className={u.activo ? '' : 'sn-equipo__inactivo'}>
                    <td>
                      <div className="sn-equipo__persona">
                        <span className="sn-equipo__avatar" aria-hidden="true">
                          {u.nombre.charAt(0).toUpperCase()}
                        </span>
                        <span>
                          <strong>{u.nombre}</strong>
                          {u.id === usuario.id && <small> (vos)</small>}
                        </span>
                      </div>
                    </td>
                    <td className="sn-silencio">{u.email}</td>
                    <td>
                      <span
                        className={`sn-badge sn-badge--${u.role === 'SUPERADMIN' ? 'marca' : u.role === 'OWNER' ? 'info' : 'neutro'}`}
                      >
                        {textos.admin.roles[u.role]}
                      </span>
                    </td>
                    {esSuperadmin && <td className="sn-silencio">{u.parking?.nombre ?? '—'}</td>}
                    <td className="sn-silencio">
                      {u.ultimoLogin ? fechaHora(u.ultimoLogin) : textos.admin.equipo.nunca}
                    </td>
                    <td>
                      <span className={`sn-badge sn-badge--${u.activo ? 'ok' : 'error'}`}>
                        {u.activo ? textos.admin.equipo.activo : textos.admin.equipo.inactivo}
                      </span>
                    </td>
                    <td className="sn-equipo__acciones">
                      {u.id !== usuario.id && (
                        <>
                          <button
                            type="button"
                            className="sn-boton sn-boton--fantasma sn-boton--sm"
                            onClick={() => alternarActivo(u)}
                          >
                            {u.activo ? textos.admin.equipo.darDeBaja : 'Reactivar'}
                          </button>
                          <button
                            type="button"
                            className="sn-tabla-reservas__icono sn-equipo__borrar"
                            onClick={() => setAEliminar(u)}
                            title={textos.admin.equipo.eliminar}
                          >
                            <Icono nombre="basura" tam={16} />
                            <span className="sn-solo-lectores">
                              {textos.admin.equipo.eliminar} a {u.nombre}
                            </span>
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Alta ── */}
      <Modal
        abierto={modal}
        alCerrar={() => setModal(false)}
        titulo={textos.admin.equipo.nuevo}
        pie={
          <>
            <button
              type="button"
              className="sn-boton sn-boton--fantasma"
              onClick={() => setModal(false)}
              disabled={guardando}
            >
              {textos.comunes.cancelar}
            </button>
            <button
              type="button"
              className="sn-boton sn-boton--primario"
              onClick={guardar}
              disabled={guardando}
            >
              {guardando ? textos.comunes.guardando : textos.comunes.guardar}
            </button>
          </>
        }
      >
        <div className="sn-equipo__form">
          <Campo
            label={textos.admin.equipo.nombre}
            obligatorio
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            error={errores.nombre}
          />

          <Campo
            type="email"
            label={textos.admin.equipo.email}
            obligatorio
            autoComplete="off"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            error={errores.email}
          />

          <Campo
            type="text"
            label={textos.admin.equipo.password}
            ayuda={textos.admin.equipo.passwordAyuda}
            obligatorio
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            error={errores.password}
          />

          <Campo
            type="tel"
            label={textos.checkout.telefono}
            opcional
            value={form.telefono}
            onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
          />

          <CampoSelect
            label={textos.admin.equipo.rol}
            obligatorio
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            opciones={rolesPosibles.map((r) => ({ valor: r, etiqueta: textos.admin.roles[r] }))}
          />

          {textos.admin.equipo.rolAyuda[form.role] && (
            <Aviso tipo="info">{textos.admin.equipo.rolAyuda[form.role]}</Aviso>
          )}

          {esSuperadmin && form.role !== 'SUPERADMIN' && (
            <CampoSelect
              label="Estacionamiento"
              obligatorio
              value={form.parkingId}
              onChange={(e) => setForm((f) => ({ ...f, parkingId: e.target.value }))}
              placeholder="Elegí uno"
              error={errores.parkingId}
              opciones={parkings.map((p) => ({ valor: p.id, etiqueta: p.nombre }))}
            />
          )}
        </div>
      </Modal>
      <Modal
        abierto={Boolean(aEliminar)}
        alCerrar={() => setAEliminar(null)}
        titulo={textos.admin.equipo.eliminarTitulo}
        ancho={460}
        pie={
          <>
            <button
              type="button"
              className="sn-boton sn-boton--fantasma"
              onClick={() => setAEliminar(null)}
            >
              {textos.comunes.cancelar}
            </button>
            <button
              type="button"
              className="sn-boton sn-boton--peligro"
              onClick={eliminar}
              disabled={eliminando}
            >
              {eliminando ? textos.comunes.guardando : textos.admin.equipo.eliminar}
            </button>
          </>
        }
      >
        <div className="sn-form">
          <Aviso tipo="error">{textos.admin.equipo.eliminarAviso}</Aviso>
          {aEliminar && (
            <p>
              <strong>{aEliminar.nombre}</strong> · {aEliminar.email}
            </p>
          )}
          <p className="sn-silencio">{textos.admin.equipo.eliminarHistorial}</p>
        </div>
      </Modal>
    </>
  );
}

export default Equipo;
