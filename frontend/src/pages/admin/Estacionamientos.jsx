/**
 * Estacionamientos de la plataforma (solo SUPERADMIN).
 *
 * Alta, publicación, comisión y baja. El alta crea también el usuario OWNER,
 * que es lo que hace falta para que el estacionamiento pueda empezar a operar.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icono } from '../../components/ui/Iconos.jsx';
import { Cargando, ErrorCarga, Vacio } from '../../components/ui/Estado.jsx';
import { Modal, Aviso } from '../../components/ui/Varios.jsx';
import { Campo, CampoTexto, CampoCheck } from '../../components/ui/Campo.jsx';
import BuscadorDireccion from '../../components/busqueda/BuscadorDireccion.jsx';
import { admin } from '../../services/spotnear.service.js';
import { usePedido, useTitulo, useRefrescoAutomatico } from '../../hooks/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { esEmailValido } from '../../utils/validaciones.js';
import textos from '../../i18n/textos.js';
import './Estacionamientos.css';

const FORM_VACIO = {
  nombre: '',
  descripcion: '',
  destino: null,
  barrio: '',
  telefono: '',
  capacidadTotal: 30,
  // Sin tildar a propósito: ver el comentario del mismo campo en el registro.
  cubierto: false,
  comisionPorcentaje: 20,
  publicado: true,
  ownerNombre: '',
  ownerEmail: '',
  ownerPassword: '',
};

export function Estacionamientos() {
  const { esSuperadmin } = useAuth();
  const toast = useToast();
  useTitulo(textos.admin.estacionamientos.titulo);

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [editandoComision, setEditandoComision] = useState(null);

  const { datos, cargando, error, recargar } = usePedido(
    ({ signal }) => admin.parkings.listar({ incluirInactivos: true }, { signal }),
    [],
  );

  // Los contadores de reservas de cada fila envejecen mientras la pantalla
  // queda abierta: se refrescan al volver el foco y cada minuto.
  useRefrescoAutomatico(recargar);

  const parkings = datos?.parkings ?? [];

  if (!esSuperadmin) {
    return (
      <Vacio
        icono="candado"
        titulo={textos.errores.sinPermiso}
        texto="Esta sección es exclusiva del administrador de la plataforma."
      />
    );
  }

  const set = (cambios) => {
    setForm((f) => ({ ...f, ...cambios }));
    setErrores({});
  };

  const crear = async () => {
    const nuevos = {};
    if (!form.nombre.trim()) nuevos.nombre = textos.errores.campoObligatorio;
    if (!form.destino) nuevos.destino = 'Buscá la dirección para fijar la ubicación';
    if (!form.capacidadTotal || Number(form.capacidadTotal) < 1) {
      nuevos.capacidadTotal = 'La capacidad tiene que ser al menos 1';
    }
    if (form.ownerEmail && !esEmailValido(form.ownerEmail)) {
      nuevos.ownerEmail = textos.errores.emailInvalido;
    }
    if (form.ownerEmail && form.ownerPassword.length < 8) {
      nuevos.ownerPassword = textos.errores.passwordCorta;
    }
    if (form.ownerEmail && !form.ownerNombre.trim()) {
      nuevos.ownerNombre = textos.errores.campoObligatorio;
    }

    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    setGuardando(true);
    try {
      await admin.parkings.crear({
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || undefined,
        direccion: form.destino.nombre,
        barrio: form.barrio.trim() || undefined,
        lat: form.destino.lat,
        lng: form.destino.lng,
        telefono: form.telefono.trim() || undefined,
        capacidadTotal: Number(form.capacidadTotal),
        cubierto: form.cubierto,
        comisionPorcentaje: Number(form.comisionPorcentaje),
        publicado: form.publicado,
        owner: form.ownerEmail
          ? {
              nombre: form.ownerNombre.trim(),
              email: form.ownerEmail.trim(),
              password: form.ownerPassword,
            }
          : undefined,
      });
      toast.ok('Estacionamiento creado');
      setModal(false);
      setForm(FORM_VACIO);
      recargar();
    } catch (e) {
      toast.error(e.message ?? textos.errores.generico);
      const deCampo = e.erroresDeCampo ?? {};
      if (Object.keys(deCampo).length > 0) setErrores(deCampo);
    } finally {
      setGuardando(false);
    }
  };

  const alternarPublicado = async (p) => {
    try {
      await admin.parkings.editar(p.id, { publicado: !p.publicado });
      toast.ok(p.publicado ? 'Despublicado' : 'Publicado');
      recargar();
    } catch (e) {
      toast.error(e.message ?? textos.errores.generico);
    }
  };

  const darDeBaja = async (p) => {
    if (!window.confirm(`¿Dar de baja "${p.nombre}"? Deja de operar y de aparecer en la búsqueda.`)) {
      return;
    }
    try {
      await admin.parkings.darDeBaja(p.id);
      toast.ok(`${p.nombre} dado de baja`);
      recargar();
    } catch (e) {
      toast.error(e.message ?? textos.errores.generico);
    }
  };

  const guardarComision = async (p, valor) => {
    const num = Number(valor);
    if (Number.isNaN(num) || num < 0 || num > 100) {
      toast.error('La comisión tiene que estar entre 0 y 100.');
      return;
    }
    try {
      await admin.parkings.editar(p.id, { comisionPorcentaje: num });
      toast.ok(`Comisión de ${p.nombre}: ${num}%`);
      setEditandoComision(null);
      recargar();
    } catch (e) {
      toast.error(e.message ?? textos.errores.generico);
    }
  };

  return (
    <>
      <header className="sn-panel__cabecera">
        <div>
          <h1 className="sn-panel__titulo">{textos.admin.estacionamientos.titulo}</h1>
          <p className="sn-panel__subtitulo">{textos.admin.estacionamientos.subtitulo}</p>
        </div>
        <div className="sn-panel__acciones">
          <button type="button" className="sn-boton sn-boton--primario" onClick={() => setModal(true)}>
            <Icono nombre="mas" tam={17} />
            {textos.admin.estacionamientos.nuevo}
          </button>
        </div>
      </header>

      {cargando && <Cargando />}
      {!cargando && error && <ErrorCarga error={error} onReintentar={recargar} />}

      {!cargando && !error && parkings.length === 0 && (
        <section className="sn-panel__seccion">
          <Vacio
            icono="edificio"
            titulo="Todavía no hay estacionamientos"
            accion={
              <button type="button" className="sn-boton sn-boton--primario" onClick={() => setModal(true)}>
                <Icono nombre="mas" tam={16} />
                {textos.admin.estacionamientos.nuevo}
              </button>
            }
          />
        </section>
      )}

      {!cargando && !error && parkings.length > 0 && (
        <ul className="sn-parkings">
          {parkings.map((p) => (
            <li key={p.id} className={`sn-parking ${p.activo ? '' : 'sn-parking--baja'}`}>
              <div className="sn-parking__foto">
                <img
                  src={p.fotos?.[0]?.url ?? '/assets/parkings/sin-foto.svg'}
                  alt=""
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.src = '/assets/parkings/sin-foto.svg';
                  }}
                />
              </div>

              <div className="sn-parking__datos">
                <h2 className="sn-parking__nombre">{p.nombre}</h2>
                <p className="sn-parking__direccion">
                  <Icono nombre="pin" tam={14} />
                  {p.direccion}
                  {p.barrio && `, ${p.barrio}`}
                </p>
                <div className="sn-parking__badges">
                  {!p.activo && <span className="sn-badge sn-badge--error">Dado de baja</span>}
                  <span className={`sn-badge sn-badge--${p.publicado ? 'ok' : 'neutro'}`}>
                    {p.publicado
                      ? textos.admin.estacionamientos.publicado
                      : textos.admin.estacionamientos.noPublicado}
                  </span>
                  <span className="sn-badge sn-badge--neutro">
                    {textos.parking.lugares(p.capacidadTotal)}
                  </span>
                  {p._count && (
                    <span className="sn-badge sn-badge--info sn-badge--contador">
                      {p._count.reservas} {p._count.reservas === 1 ? 'reserva' : 'reservas'}
                    </span>
                  )}
                </div>
              </div>

              <div className="sn-parking__comision">
                <span className="sn-parking__comision-etiqueta">
                  {textos.admin.estacionamientos.comision}
                </span>
                {editandoComision === p.id ? (
                  <input
                    type="number"
                    className="sn-input sn-parking__comision-input"
                    defaultValue={p.comisionPorcentaje}
                    min={0}
                    max={100}
                    step={0.5}
                    autoFocus
                    onBlur={(e) => guardarComision(p, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') setEditandoComision(null);
                    }}
                    aria-label={`Comisión de ${p.nombre}`}
                  />
                ) : (
                  <button
                    type="button"
                    className="sn-parking__comision-valor"
                    onClick={() => setEditandoComision(p.id)}
                    title="Clic para editar"
                  >
                    {p.comisionPorcentaje}%
                    <Icono nombre="editar" tam={13} />
                  </button>
                )}
              </div>

              <div className="sn-parking__acciones">
                <Link
                  to={`/panel/mi-estacionamiento?parkingId=${p.id}`}
                  className="sn-boton sn-boton--secundario sn-boton--sm"
                >
                  <Icono nombre="editar" tam={15} />
                  {textos.comunes.editar}
                </Link>

                <button
                  type="button"
                  className="sn-boton sn-boton--fantasma sn-boton--sm"
                  onClick={() => alternarPublicado(p)}
                  disabled={!p.activo}
                >
                  {p.publicado
                    ? textos.admin.estacionamientos.despublicar
                    : textos.admin.estacionamientos.publicar}
                </button>

                {p.activo && (
                  <button
                    type="button"
                    className="sn-boton sn-boton--peligro sn-boton--sm"
                    onClick={() => darDeBaja(p)}
                  >
                    {textos.admin.estacionamientos.darDeBaja}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ── Alta ── */}
      <Modal
        abierto={modal}
        alCerrar={() => setModal(false)}
        titulo={textos.admin.estacionamientos.nuevo}
        ancho={560}
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
              onClick={crear}
              disabled={guardando}
            >
              {guardando ? textos.comunes.guardando : textos.comunes.guardar}
            </button>
          </>
        }
      >
        <div className="sn-parkings__form">
          <Campo
            label="Nombre"
            placeholder="Estacionamiento Humboldt 650"
            obligatorio
            value={form.nombre}
            onChange={(e) => set({ nombre: e.target.value })}
            error={errores.nombre}
          />

          <BuscadorDireccion
            label="Dirección"
            valor={form.destino}
            onChange={(d) => set({ destino: d })}
            error={errores.destino}
            placeholder="Buscá la dirección del estacionamiento"
          />

          <div className="sn-grilla-campos sn-grilla-campos--2">
            <Campo
              label="Barrio"
              placeholder="Villa Crespo"
              value={form.barrio}
              onChange={(e) => set({ barrio: e.target.value })}
            />
            <Campo
              type="tel"
              label="Teléfono"
              value={form.telefono}
              onChange={(e) => set({ telefono: e.target.value })}
            />
          </div>

          <CampoTexto
            label="Descripción"
            rows={2}
            opcional
            value={form.descripcion}
            onChange={(e) => set({ descripcion: e.target.value })}
          />

          <div className="sn-grilla-campos sn-grilla-campos--2">
            <Campo
              type="number"
              min={1}
              label={textos.parking.capacidad}
              obligatorio
              value={form.capacidadTotal}
              onChange={(e) => set({ capacidadTotal: e.target.value })}
              error={errores.capacidadTotal}
            />
            <Campo
              type="number"
              min={0}
              max={100}
              step={0.5}
              label="Comisión SpotNear (%)"
              ayuda="Por defecto 20%."
              value={form.comisionPorcentaje}
              onChange={(e) => set({ comisionPorcentaje: e.target.value })}
            />
          </div>

          <div className="sn-parkings__checks">
            <CampoCheck
              label={textos.resultados.cubierto}
              checked={form.cubierto}
              onChange={(e) => set({ cubierto: e.target.checked })}
            />
            <CampoCheck
              label="Publicar en la búsqueda"
              checked={form.publicado}
              onChange={(e) => set({ publicado: e.target.checked })}
            />
          </div>

          <hr className="sn-separador" />

          <div>
            <h3 className="sn-parkings__subtitulo">{textos.admin.estacionamientos.datosDelDueno}</h3>
            <p className="sn-est__ayuda">{textos.admin.estacionamientos.datosDelDuenoAyuda}</p>
          </div>

          <Campo
            label="Nombre del dueño"
            value={form.ownerNombre}
            onChange={(e) => set({ ownerNombre: e.target.value })}
            error={errores.ownerNombre}
          />

          <div className="sn-grilla-campos sn-grilla-campos--2">
            <Campo
              type="email"
              label="Email"
              autoComplete="off"
              value={form.ownerEmail}
              onChange={(e) => set({ ownerEmail: e.target.value })}
              error={errores.ownerEmail}
            />
            <Campo
              type="text"
              label="Contraseña"
              ayuda="Mínimo 8 caracteres."
              autoComplete="new-password"
              value={form.ownerPassword}
              onChange={(e) => set({ ownerPassword: e.target.value })}
              error={errores.ownerPassword}
            />
          </div>

          <Aviso tipo="info">
            Después de crearlo, cargale al menos una <strong>tarifa por hora</strong> desde la
            sección Tarifas: sin eso no va a aparecer en las búsquedas.
          </Aviso>
        </div>
      </Modal>
    </>
  );
}

export default Estacionamientos;
