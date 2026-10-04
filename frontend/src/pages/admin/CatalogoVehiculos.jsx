/**
 * Catálogo de vehículos (solo SUPERADMIN).
 *
 * Marca + modelo → tipo de vehículo. Es la tabla con la que el checkout
 * detecta el tipo cuando el cliente escribe su auto, para preseleccionarlo y
 * cotizar la tarifa que corresponde. Se amplía desde acá cada vez que aparece
 * un modelo que el sistema no reconoce, sin tocar código.
 */
import { useMemo, useState } from 'react';
import { Campo } from '../../components/ui/Campo.jsx';
import { Icono } from '../../components/ui/Iconos.jsx';
import { Cargando, ErrorCarga, Vacio } from '../../components/ui/Estado.jsx';
import { Aviso, Modal } from '../../components/ui/Varios.jsx';
import { admin } from '../../services/spotnear.service.js';
import { usePedido, useTitulo } from '../../hooks/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import textos from '../../i18n/textos.js';

const TIPOS = ['AUTO', 'SUV', 'CAMIONETA', 'UTILITARIO', 'MOTO'];
const VACIO = { marca: '', modelo: '', tipo: 'AUTO' };

const sinTildes = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function CatalogoVehiculos() {
  const t = textos.admin.catalogo;
  useTitulo(t.titulo);
  const toast = useToast();

  const { datos, cargando, error, recargar } = usePedido(
    ({ signal }) => admin.catalogoVehiculos.listar({ signal }),
    [],
  );

  const [filtro, setFiltro] = useState('');
  // null = cerrado · { id: null } = alta · { id } = edición
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [aEliminar, setAEliminar] = useState(null);

  const modelos = useMemo(() => datos?.modelos ?? [], [datos]);
  const visibles = useMemo(() => {
    const q = sinTildes(filtro).trim();
    if (!q) return modelos;
    return modelos.filter((m) => sinTildes(`${m.marca} ${m.modelo}`).includes(q));
  }, [modelos, filtro]);

  const abrir = (fila = null) => {
    setEditando(fila ? { id: fila.id } : { id: null });
    setForm(fila ? { marca: fila.marca, modelo: fila.modelo, tipo: fila.tipo } : VACIO);
    setErrores({});
  };

  const guardar = async (e) => {
    e.preventDefault();
    const nuevos = {};
    if (!form.marca.trim()) nuevos.marca = textos.errores.campoObligatorio;
    if (!form.modelo.trim()) nuevos.modelo = textos.errores.campoObligatorio;
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    setGuardando(true);
    try {
      const datosFila = { marca: form.marca.trim(), modelo: form.modelo.trim(), tipo: form.tipo };
      if (editando.id) await admin.catalogoVehiculos.editar(editando.id, datosFila);
      else await admin.catalogoVehiculos.crear(datosFila);
      toast.ok(editando.id ? t.editado : t.agregado(`${datosFila.marca} ${datosFila.modelo}`));
      setEditando(null);
      recargar();
    } catch (err) {
      const deCampo = err.erroresDeCampo ?? {};
      if (Object.keys(deCampo).length > 0) setErrores(deCampo);
      else toast.error(err.message ?? textos.errores.generico);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    setGuardando(true);
    try {
      await admin.catalogoVehiculos.eliminar(aEliminar.id);
      toast.ok(t.eliminado(`${aEliminar.marca} ${aEliminar.modelo}`));
      setAEliminar(null);
      recargar();
    } catch (err) {
      toast.error(err.message ?? textos.errores.generico);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <header className="sn-panel__cabecera">
        <div>
          <h1 className="sn-panel__titulo">{t.titulo}</h1>
          <p className="sn-panel__subtitulo">{t.subtitulo}</p>
        </div>
        <div className="sn-panel__acciones">
          <button type="button" className="sn-boton sn-boton--primario" onClick={() => abrir()}>
            <Icono nombre="mas" tam={17} />
            {t.agregar}
          </button>
        </div>
      </header>

      <section className="sn-panel__seccion">
        <div style={{ maxWidth: 360, marginBottom: 'var(--sn-e4)' }}>
          <Campo
            name="filtro"
            label={t.buscar}
            placeholder="Toyota, Duster, Hilux..."
            autoComplete="off"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>

        {cargando && <Cargando />}
        {!cargando && error && <ErrorCarga error={error} onReintentar={recargar} />}
        {!cargando && !error && visibles.length === 0 && (
          <Vacio icono="auto" titulo={t.vacio} texto={filtro ? t.vacioFiltro : t.vacioTexto} />
        )}

        {!cargando && !error && visibles.length > 0 && (
          <>
            <p className="sn-silencio" style={{ marginBottom: 'var(--sn-e2)' }}>
              {t.cantidad(visibles.length, modelos.length)}
            </p>
            <div className="sn-tabla-scroll">
              <table className="sn-tabla">
                <thead>
                  <tr>
                    <th>{t.marca}</th>
                    <th>{t.modelo}</th>
                    <th>{t.tipo}</th>
                    <th aria-label={t.acciones} />
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((m) => (
                    <tr key={m.id}>
                      <td>{m.marca}</td>
                      <td>
                        <strong>{m.modelo}</strong>
                      </td>
                      <td>{textos.parking.tiposVehiculo[m.tipo] ?? m.tipo}</td>
                      <td>
                        <div className="sn-tabla-reservas__fila-acciones">
                          <button
                            type="button"
                            className="sn-tabla-reservas__icono"
                            onClick={() => abrir(m)}
                            title={t.editar}
                          >
                            <Icono nombre="editar" tam={17} />
                            <span className="sn-solo-lectores">{t.editar}</span>
                          </button>
                          <button
                            type="button"
                            className="sn-tabla-reservas__icono sn-tabla-reservas__icono--peligro"
                            onClick={() => setAEliminar(m)}
                            title={t.eliminar}
                          >
                            <Icono nombre="basura" tam={17} />
                            <span className="sn-solo-lectores">{t.eliminar}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* ── Alta / edición ── */}
      <Modal
        abierto={Boolean(editando)}
        alCerrar={() => setEditando(null)}
        titulo={editando?.id ? t.editarTitulo : t.agregarTitulo}
        ancho={460}
        pie={
          <>
            <button type="button" className="sn-boton sn-boton--fantasma" onClick={() => setEditando(null)}>
              {textos.comunes.cancelar}
            </button>
            <button
              type="submit"
              form="sn-form-catalogo"
              className="sn-boton sn-boton--primario"
              disabled={guardando}
            >
              {guardando ? textos.comunes.guardando : textos.comunes.guardar}
            </button>
          </>
        }
      >
        <form id="sn-form-catalogo" className="sn-form" onSubmit={guardar} noValidate>
          <Campo
            name="marca"
            label={t.marca}
            obligatorio
            autoComplete="off"
            placeholder="Renault"
            value={form.marca}
            onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))}
            error={errores.marca}
          />
          <Campo
            name="modelo"
            label={t.modelo}
            obligatorio
            autoComplete="off"
            placeholder="Duster"
            ayuda={t.ayudaModelo}
            value={form.modelo}
            onChange={(e) => setForm((f) => ({ ...f, modelo: e.target.value }))}
            error={errores.modelo}
          />
          <label className="sn-campo">
            <span className="sn-campo__label">{t.tipo}</span>
            <select
              className="sn-select"
              value={form.tipo}
              onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
            >
              {TIPOS.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {textos.parking.tiposVehiculo[tipo] ?? tipo}
                </option>
              ))}
            </select>
          </label>
        </form>
      </Modal>

      {/* ── Eliminar ── */}
      <Modal
        abierto={Boolean(aEliminar)}
        alCerrar={() => setAEliminar(null)}
        titulo={aEliminar ? t.eliminarTitulo(`${aEliminar.marca} ${aEliminar.modelo}`) : ''}
        ancho={440}
        pie={
          <>
            <button type="button" className="sn-boton sn-boton--fantasma" onClick={() => setAEliminar(null)}>
              {textos.comunes.cancelar}
            </button>
            <button type="button" className="sn-boton sn-boton--peligro" onClick={eliminar} disabled={guardando}>
              {guardando ? textos.comunes.guardando : t.eliminar}
            </button>
          </>
        }
      >
        <Aviso tipo="aviso">{t.eliminarTexto}</Aviso>
      </Modal>
    </>
  );
}

export default CatalogoVehiculos;
