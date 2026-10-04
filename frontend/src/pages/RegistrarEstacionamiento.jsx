/**
 * Registro público de estacionamientos (autogestión del dueño).
 *
 * Tres pasos en vez de un formulario largo: son ~15 campos y de un saque
 * espantan. Cada paso valida lo suyo antes de dejar avanzar, así el error
 * aparece cerca de donde se cometió y no todo junto al final.
 *
 * Lo que se manda crea el estacionamiento EN ESTADO PENDIENTE: no se publica ni
 * habilita al dueño hasta que ColdevIA lo aprueba desde el panel.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { Icono, ICONO_SERVICIO, ICONO_VEHICULO } from '../components/ui/Iconos.jsx';
import { Campo, CampoTexto, CampoCheck } from '../components/ui/Campo.jsx';
import SubirFotos, { MAX_FOTOS } from '../components/ui/SubirFotos.jsx';
import { Aviso } from '../components/ui/Varios.jsx';
import BuscadorDireccion from '../components/busqueda/BuscadorDireccion.jsx';
import { MAP_ID, useEstadoMapas } from '../components/mapas/ProveedorMapas.jsx';
import { publico } from '../services/spotnear.service.js';
import { precio as fmtPrecio } from '../utils/formato.js';
import { useTitulo } from '../hooks/index.js';
import { useToast } from '../context/ToastContext.jsx';
import { esEmailValido, esTelefonoValido, normalizarTelefono } from '../utils/validaciones.js';
import textos from '../i18n/textos.js';
import './RegistrarEstacionamiento.css';

const t = textos.registro;

const SERVICIOS = ['camaras', '24hs', 'vigilancia', 'techado', 'lavado', 'valet', 'cargador_electrico'];
const VEHICULOS = ['AUTO', 'SUV', 'CAMIONETA', 'MOTO', 'UTILITARIO'];
const TOTAL_PASOS = 3;

const FORM_VACIO = {
  // Paso 1
  nombre: '',
  apellido: '',
  email: '',
  telefono: '',
  password: '',
  password2: '',
  // Paso 2
  nombreComercial: '',
  descripcion: '',
  destino: null,
  barrio: '',
  lat: null,
  lng: null,
  capacidadTotal: '',
  tiposVehiculo: ['AUTO'],
  // Sin tildar: el tag "Cubierto" de los resultados sale de acá y tiene que
  // ser una decisión del dueño, no un default.
  cubierto: false,
  // Los tres modos de cierre son excluyentes; arranca en el más común.
  tipoHorario: 'FIJO',
  abre: '08:00',
  cierra: '22:00',
  servicios: [],
  // URLs ya subidas al servidor, en el orden en que se cargaron.
  fotos: [],
  // Alternativa: pegar links de fotos publicadas en otro lado.
  fotosUrl: '',
  // Paso 3
  aceptaComision: false,
  aceptaTerminos: false,
};

/**
 * Todas las fotos del formulario: las que se subieron desde el dispositivo más
 * las que se pegaron como URL. Se deduplican por si alguien pega una que ya subió.
 */
function fotosDelFormulario(form) {
  const pegadas = form.fotosUrl
    .split('\n')
    .map((u) => u.trim())
    .filter(Boolean);
  return [...new Set([...form.fotos, ...pegadas])].slice(0, MAX_FOTOS);
}

export function RegistrarEstacionamiento() {
  useTitulo(t.titulo);
  const navegar = useNavigate();
  const toast = useToast();
  const { disponible: hayMapa } = useEstadoMapas();

  const [paso, setPaso] = useState(1);
  const [form, setForm] = useState(FORM_VACIO);
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(null);

  const set = (cambios) => {
    setForm((f) => ({ ...f, ...cambios }));
    // Se limpian solo los errores de los campos tocados, no todos: si el
    // usuario corrige el email, el error del teléfono tiene que seguir visible.
    setErrores((e) => {
      const copia = { ...e };
      for (const k of Object.keys(cambios)) delete copia[k];
      return copia;
    });
  };

  const alternar = (campo, valor) =>
    set({
      [campo]: form[campo].includes(valor)
        ? form[campo].filter((v) => v !== valor)
        : [...form[campo], valor],
    });

  /* ── Validación, un paso por vez ── */

  const validarPaso1 = () => {
    const e = {};
    if (!form.nombre.trim()) e.nombre = textos.errores.campoObligatorio;
    if (!form.apellido.trim()) e.apellido = textos.errores.campoObligatorio;
    if (!form.email.trim()) e.email = textos.errores.campoObligatorio;
    else if (!esEmailValido(form.email)) e.email = textos.errores.emailInvalido;
    if (!form.telefono.trim()) e.telefono = textos.errores.campoObligatorio;
    else if (!esTelefonoValido(form.telefono)) e.telefono = textos.errores.telefonoInvalido;
    if (form.password.length < 8) e.password = textos.errores.passwordCorta;
    if (form.password !== form.password2) e.password2 = t.passwordNoCoincide;
    return e;
  };

  const validarPaso2 = () => {
    const e = {};
    if (!form.nombreComercial.trim()) e.nombreComercial = textos.errores.campoObligatorio;
    if (!form.destino || form.lat === null) e.destino = t.direccionAyuda;
    const capacidad = Number(form.capacidadTotal);
    if (!form.capacidadTotal || !Number.isInteger(capacidad) || capacidad < 1) {
      e.capacidadTotal = 'Ingresá cuántos vehículos entran, como número entero.';
    }
    if (form.tiposVehiculo.length === 0) {
      e.tiposVehiculo = 'Elegí al menos un tipo de vehículo.';
    }
    // Las fotos pasaron a ser obligatorias: sin al menos una, el estacionamiento
    // se publica con el placeholder y nadie lo reserva.
    if (fotosDelFormulario(form).length === 0) {
      e.fotos = t.fotosFaltan;
    }
    return e;
  };

  const validarPaso3 = () => {
    const e = {};
    if (!form.aceptaComision) e.aceptaComision = 'Tenés que aceptar la comisión para continuar.';
    if (!form.aceptaTerminos) e.aceptaTerminos = 'Tenés que aceptar los términos para continuar.';
    return e;
  };

  const validadores = { 1: validarPaso1, 2: validarPaso2, 3: validarPaso3 };

  const avanzar = () => {
    const e = validadores[paso]();
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setPaso((p) => Math.min(TOTAL_PASOS, p + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * Enter dentro de un formulario dispara el submit del navegador. En un
   * asistente por pasos eso significa mandar la solicitud desde el paso 1, con
   * medio formulario sin completar. Acá Enter avanza de paso, y solo en el
   * último envía de verdad.
   *
   * Se respeta `defaultPrevented`: el buscador de direcciones usa Enter para
   * elegir una sugerencia y ya lo cancela por su cuenta.
   */
  const alTeclado = (e) => {
    if (e.key !== 'Enter' || paso === TOTAL_PASOS) return;
    if (e.defaultPrevented) return;
    // En un textarea, Enter es un salto de línea.
    if (e.target.tagName === 'TEXTAREA') return;

    e.preventDefault();
    avanzar();
  };

  const retroceder = () => {
    setErrores({});
    setPaso((p) => Math.max(1, p - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ── Envío ── */

  const enviar = async (ev) => {
    ev.preventDefault();

    // Se revalida todo, no solo el último paso: puede haber vuelto atrás.
    const e = { ...validarPaso1(), ...validarPaso2(), ...validarPaso3() };
    setErrores(e);
    if (Object.keys(e).length > 0) {
      const primerPaso = Object.keys(validarPaso1()).length > 0 ? 1 : Object.keys(validarPaso2()).length > 0 ? 2 : 3;
      setPaso(primerPaso);
      return;
    }

    setEnviando(true);
    try {
      // El JSON de horarios se arma según el modo elegido. En FIN_EVENTO cada
      // día lleva solo `abre`: la hora de cierre no existe.
      const dias = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
      const horarios =
        form.tipoHorario === 'ABIERTO_24HS'
          ? { abierto24h: true }
          : Object.fromEntries(
              dias.map((d) => [
                d,
                form.tipoHorario === 'FIN_EVENTO'
                  ? { abre: form.abre }
                  : { abre: form.abre, cierra: form.cierra },
              ]),
            );

      const respuesta = await publico.registrarEstacionamiento({
        duenio: {
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          email: form.email.trim(),
          telefono: normalizarTelefono(form.telefono) ?? form.telefono.trim(),
          password: form.password,
        },
        parking: {
          nombre: form.nombreComercial.trim(),
          descripcion: form.descripcion.trim() || undefined,
          direccion: form.destino.nombre,
          barrio: form.barrio.trim() || undefined,
          lat: form.lat,
          lng: form.lng,
          capacidadTotal: Number(form.capacidadTotal),
          cubierto: form.cubierto,
          tiposVehiculo: form.tiposVehiculo,
          servicios: form.servicios,
          tipoHorario: form.tipoHorario,
          horarios,
          fotos: fotosDelFormulario(form),
        },
        aceptaTerminos: true,
        aceptaComision: true,
      });

      setListo(respuesta.solicitud);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      toast.error(error.message ?? textos.errores.generico);
      const deCampo = error.erroresDeCampo ?? {};
      // El backend nombra los campos anidados ("duenio.email"): se aplanan
      // para que coincidan con las claves del formulario.
      const aplanados = Object.fromEntries(
        Object.entries(deCampo).map(([k, v]) => [k.split('.').pop(), v]),
      );
      if (Object.keys(aplanados).length > 0) {
        setErrores(aplanados);
        if (aplanados.email || aplanados.password || aplanados.telefono) setPaso(1);
      }
    } finally {
      setEnviando(false);
    }
  };

  /* ── Pantalla de confirmación ── */

  if (listo) {
    return (
      <div className="sn-contenedor sn-registro sn-registro--listo">
        <div className="sn-registro__exito">
          <span className="sn-registro__exito-icono" aria-hidden="true">
            <Icono nombre="check" tam={32} />
          </span>
          <h1>{t.exitoTitulo}</h1>
          <p className="sn-registro__exito-texto">{t.exitoTexto}</p>

          <div className="sn-registro__exito-ficha">
            <span className="sn-registro__exito-etiqueta">{t.nombreComercial}</span>
            <strong>{listo.nombre}</strong>
            <span className="sn-registro__exito-etiqueta">{t.email}</span>
            <strong>{listo.email}</strong>
          </div>

          <h2 className="sn-registro__exito-subtitulo">{t.exitoQueSigue}</h2>
          <ol className="sn-registro__exito-pasos">
            {t.exitoPasos.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>

          <button type="button" className="sn-boton sn-boton--primario sn-boton--lg" onClick={() => navegar('/')}>
            {t.exitoVolver}
          </button>
        </div>
      </div>
    );
  }

  /* ── Formulario ── */

  return (
    <div className="sn-registro">
      <header className="sn-registro__hero">
        <div className="sn-contenedor sn-registro__hero-interior">
          <div>
            <h1 className="sn-registro__titulo">{t.titulo}</h1>
            <p className="sn-registro__subtitulo">{t.subtitulo}</p>
          </div>

          <ul className="sn-registro__beneficios">
            {t.beneficios.map((b, i) => (
              <li key={b.titulo}>
                <span className="sn-registro__beneficio-icono" aria-hidden="true">
                  <Icono nombre={['ticket', 'tablero', 'dinero'][i]} tam={19} />
                </span>
                <div>
                  <strong>{b.titulo}</strong>
                  <span>{b.texto}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </header>

      <div className="sn-contenedor sn-registro__cuerpo">
        {/* Indicador de pasos. aria-current marca el actual para el lector. */}
        <ol className="sn-registro__pasos" aria-label={t.paso(paso, TOTAL_PASOS)}>
          {t.pasos.map((etiqueta, i) => {
            const n = i + 1;
            const estado = n < paso ? 'hecho' : n === paso ? 'actual' : 'pendiente';
            return (
              <li key={etiqueta} className={`sn-registro__paso sn-registro__paso--${estado}`}>
                <span className="sn-registro__paso-numero" aria-hidden="true">
                  {n < paso ? <Icono nombre="check" tam={14} /> : n}
                </span>
                <span className="sn-registro__paso-texto" aria-current={n === paso ? 'step' : undefined}>
                  {etiqueta}
                </span>
              </li>
            );
          })}
        </ol>

        <form className="sn-registro__form" onSubmit={enviar} onKeyDown={alTeclado} noValidate>
          {/* ─────────── Paso 1: el dueño ─────────── */}
          {paso === 1 && (
            <section className="sn-registro__seccion">
              <h2>{t.seccionDuenio}</h2>
              <p className="sn-registro__ayuda">{t.seccionDuenioAyuda}</p>

              <div className="sn-grilla-campos sn-grilla-campos--2">
                <Campo
                  label={t.nombre}
                  obligatorio
                  autoComplete="given-name"
                  value={form.nombre}
                  onChange={(e) => set({ nombre: e.target.value })}
                  error={errores.nombre}
                />
                <Campo
                  label={t.apellido}
                  obligatorio
                  autoComplete="family-name"
                  value={form.apellido}
                  onChange={(e) => set({ apellido: e.target.value })}
                  error={errores.apellido}
                />
              </div>

              <div className="sn-grilla-campos sn-grilla-campos--2">
                <Campo
                  label={t.email}
                  type="email"
                  obligatorio
                  autoComplete="email"
                  ayuda={t.emailAyuda}
                  value={form.email}
                  onChange={(e) => set({ email: e.target.value })}
                  error={errores.email}
                />
                <Campo
                  label={t.telefono}
                  type="tel"
                  obligatorio
                  autoComplete="tel"
                  placeholder="11 1234 5678"
                  value={form.telefono}
                  onChange={(e) => set({ telefono: e.target.value })}
                  error={errores.telefono}
                />
              </div>

              <div className="sn-grilla-campos sn-grilla-campos--2">
                <Campo
                  label={t.password}
                  type="password"
                  obligatorio
                  autoComplete="new-password"
                  ayuda={t.passwordAyuda}
                  value={form.password}
                  onChange={(e) => set({ password: e.target.value })}
                  error={errores.password}
                />
                <Campo
                  label={t.passwordRepetir}
                  type="password"
                  obligatorio
                  autoComplete="new-password"
                  value={form.password2}
                  onChange={(e) => set({ password2: e.target.value })}
                  error={errores.password2}
                />
              </div>
            </section>
          )}

          {/* ─────────── Paso 2: el estacionamiento ─────────── */}
          {paso === 2 && (
            <section className="sn-registro__seccion">
              <h2>{t.seccionParking}</h2>

              <Campo
                label={t.nombreComercial}
                obligatorio
                ayuda={t.nombreComercialAyuda}
                placeholder="Estacionamiento Humboldt"
                value={form.nombreComercial}
                onChange={(e) => set({ nombreComercial: e.target.value })}
                error={errores.nombreComercial}
              />

              <BuscadorDireccion
                label={t.direccion}
                valor={form.destino}
                onChange={(d) => {
                  if (!d) return;
                  set({ destino: d, lat: d.lat, lng: d.lng });
                }}
                error={errores.destino}
                placeholder="Humboldt 650, Villa Crespo"
              />

              {form.lat !== null && (
                <>
                  <p className="sn-registro__ayuda">{t.ubicacionAyuda}</p>
                  <div className="sn-registro__mapa">
                    {hayMapa ? (
                      <Map
                        center={{ lat: form.lat, lng: form.lng }}
                        defaultZoom={17}
                        mapId={MAP_ID}
                        gestureHandling="cooperative"
                        disableDefaultUI
                        zoomControl
                        className="sn-registro__mapa-google"
                        onClick={(e) => {
                          const pos = e.detail?.latLng;
                          if (pos) set({ lat: pos.lat, lng: pos.lng });
                        }}
                      >
                        <AdvancedMarker
                          position={{ lat: form.lat, lng: form.lng }}
                          draggable
                          onDragEnd={(e) => {
                            const pos = e.latLng;
                            if (pos) set({ lat: pos.lat(), lng: pos.lng() });
                          }}
                        >
                          <span className="sn-registro__pin">
                            <Icono nombre="pin" tam={28} />
                          </span>
                        </AdvancedMarker>
                      </Map>
                    ) : (
                      <div className="sn-registro__mapa-alt">
                        <Icono nombre="mapa" tam={28} />
                        <span>
                          Tomamos la ubicación de la dirección que elegiste. La revisamos antes de
                          publicarte.
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="sn-grilla-campos sn-grilla-campos--2">
                <Campo
                  label="Barrio"
                  opcional
                  value={form.barrio}
                  onChange={(e) => set({ barrio: e.target.value })}
                />
                <Campo
                  label={t.capacidad}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  obligatorio
                  ayuda={t.capacidadAyuda}
                  value={form.capacidadTotal}
                  onChange={(e) => set({ capacidadTotal: e.target.value })}
                  error={errores.capacidadTotal}
                />
              </div>

              <CampoTexto
                label={t.descripcion}
                opcional
                rows={3}
                ayuda={t.descripcionAyuda}
                value={form.descripcion}
                onChange={(e) => set({ descripcion: e.target.value })}
              />

              {/* Tipos de vehículo: chips, más cómodos que un multi-select. */}
              <fieldset className="sn-campo sn-registro__grupo">
                <legend className="sn-campo__label">
                  {t.tiposVehiculo}
                  <span className="sn-campo__obligatorio" aria-hidden="true">
                    *
                  </span>
                </legend>
                <div className="sn-registro__chips">
                  {VEHICULOS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`sn-registro__chip ${form.tiposVehiculo.includes(v) ? 'sn-registro__chip--activo' : ''}`}
                      aria-pressed={form.tiposVehiculo.includes(v)}
                      onClick={() => alternar('tiposVehiculo', v)}
                    >
                      <Icono nombre={ICONO_VEHICULO[v] ?? 'auto'} tam={16} />
                      {textos.parking.tiposVehiculo[v]}
                    </button>
                  ))}
                </div>
                {errores.tiposVehiculo && (
                  <span className="sn-campo__error" role="alert">
                    <Icono nombre="alerta" tam={13} />
                    {errores.tiposVehiculo}
                  </span>
                )}
              </fieldset>

              <fieldset className="sn-campo sn-registro__grupo">
                <legend className="sn-campo__label">{t.servicios}</legend>
                <div className="sn-registro__chips">
                  {SERVICIOS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`sn-registro__chip ${form.servicios.includes(s) ? 'sn-registro__chip--activo' : ''}`}
                      aria-pressed={form.servicios.includes(s)}
                      onClick={() => alternar('servicios', s)}
                    >
                      <Icono nombre={ICONO_SERVICIO[s] ?? 'check'} tam={16} />
                      {textos.parking.servicios[s] ?? s}
                    </button>
                  ))}
                </div>
              </fieldset>

              <CampoCheck
                label={t.cubierto}
                checked={form.cubierto}
                onChange={(e) => set({ cubierto: e.target.checked })}
              />

              {/* Radios de verdad y no checkboxes: los tres modos son
                  alternativas entre sí, y un radiogroup lo dice solo, también
                  para quien navega con lector de pantalla. */}
              <fieldset className="sn-campo sn-registro__grupo">
                <legend className="sn-campo__label">{t.horarios}</legend>

                <div className="sn-modos">
                  {t.horariosModos.map((m) => (
                    <label
                      key={m.id}
                      className={`sn-modos__opcion ${form.tipoHorario === m.id ? 'sn-modos__opcion--activa' : ''}`}
                    >
                      <input
                        type="radio"
                        name="tipoHorario"
                        value={m.id}
                        checked={form.tipoHorario === m.id}
                        onChange={() => set({ tipoHorario: m.id })}
                        className="sn-modos__radio"
                      />
                      <span className="sn-modos__icono" aria-hidden="true">
                        <Icono nombre={m.icono} tam={19} />
                      </span>
                      <span className="sn-modos__texto">
                        <span className="sn-modos__titulo">{m.titulo}</span>
                        <span className="sn-modos__detalle">{m.texto}</span>
                      </span>
                      <span className="sn-modos__marca" aria-hidden="true">
                        <Icono nombre="check" tam={14} />
                      </span>
                    </label>
                  ))}
                </div>

                <p className="sn-registro__ayuda">{t.horariosAyuda}</p>

                {/* Los campos aparecen según el modo; nunca se ven los de dos
                    modos a la vez. */}
                {form.tipoHorario !== 'ABIERTO_24HS' && (
                  <div className="sn-grilla-campos sn-grilla-campos--2 sn-modos__campos">
                    <Campo
                      label={t.abre}
                      type="time"
                      value={form.abre}
                      onChange={(e) => set({ abre: e.target.value })}
                    />

                    {form.tipoHorario === 'FIJO' ? (
                      <Campo
                        label={t.cierra}
                        type="time"
                        value={form.cierra}
                        onChange={(e) => set({ cierra: e.target.value })}
                      />
                    ) : (
                      <div className="sn-campo">
                        <span className="sn-campo__label">{t.cierra}</span>
                        <p className="sn-modos__cierre-evento">
                          <Icono nombre="evento" tam={16} />
                          {t.cierraConEvento}
                        </p>
                        <span className="sn-campo__ayuda">{t.cierraConEventoAyuda}</span>
                      </div>
                    )}
                  </div>
                )}
              </fieldset>

              <fieldset className="sn-campo sn-registro__grupo">
                <legend className="sn-campo__label">
                  {t.fotos}
                  <span className="sn-campo__obligatorio" aria-hidden="true">
                    *
                  </span>
                </legend>
                <p className="sn-registro__ayuda">{t.fotosAyuda}</p>

                <SubirFotos
                  fotos={form.fotos}
                  onChange={(fotos) => set({ fotos })}
                  error={errores.fotos}
                />

                <details className="sn-registro__url-fotos">
                  <summary>{t.fotosPorUrl}</summary>
                  <CampoTexto
                    label={t.fotosPorUrl}
                    opcional
                    rows={2}
                    ayuda={t.fotosPorUrlAyuda}
                    placeholder="https://..."
                    value={form.fotosUrl}
                    onChange={(e) => set({ fotosUrl: e.target.value })}
                  />
                </details>
              </fieldset>
            </section>
          )}

          {/* ─────────── Paso 3: condiciones ─────────── */}
          {paso === 3 && (
            <section className="sn-registro__seccion">
              <h2>{t.seccionCondiciones}</h2>

              {/* El acuerdo comercial va explícito y destacado, no escondido en
                  la letra chica. Con un ejemplo numérico: "20%" en abstracto no
                  le dice a nadie cuánta plata termina cobrando. */}
              <div className="sn-registro__comision">
                <span className="sn-registro__comision-icono" aria-hidden="true">
                  <Icono nombre="dinero" tam={22} />
                </span>
                <div>
                  <strong>{t.comisionTitulo}</strong>
                  <p>{t.comisionTexto}</p>
                  <p className="sn-registro__comision-ejemplo">
                    {t.comisionEjemplo(
                      fmtPrecio(26000),
                      fmtPrecio(5200),
                      fmtPrecio(31200),
                    )}
                  </p>
                </div>
              </div>

              <div className="sn-registro__condiciones">
                <CampoCheck
                  label={t.aceptaComision}
                  checked={form.aceptaComision}
                  onChange={(e) => set({ aceptaComision: e.target.checked })}
                />
                {errores.aceptaComision && (
                  <span className="sn-campo__error" role="alert">
                    <Icono nombre="alerta" tam={13} />
                    {errores.aceptaComision}
                  </span>
                )}

                <CampoCheck
                  label={
                    <>
                      Acepto los{' '}
                      <Link to="/terminos" target="_blank" rel="noopener noreferrer">
                        términos y condiciones
                      </Link>{' '}
                      y la{' '}
                      <Link to="/privacidad" target="_blank" rel="noopener noreferrer">
                        política de privacidad
                      </Link>
                    </>
                  }
                  checked={form.aceptaTerminos}
                  onChange={(e) => set({ aceptaTerminos: e.target.checked })}
                />
                {errores.aceptaTerminos && (
                  <span className="sn-campo__error" role="alert">
                    <Icono nombre="alerta" tam={13} />
                    {errores.aceptaTerminos}
                  </span>
                )}
              </div>

              <Aviso tipo="info">
                Tu solicitud queda en revisión: el estacionamiento no se publica ni aparece en las
                búsquedas hasta que la aprobemos.
              </Aviso>
            </section>
          )}

          {/* ─────────── Navegación ─────────── */}
          <div className="sn-registro__acciones">
            {paso > 1 && (
              <button type="button" className="sn-boton sn-boton--secundario" onClick={retroceder}>
                <Icono nombre="flechaIzquierda" tam={16} />
                {t.anterior}
              </button>
            )}

            {paso < TOTAL_PASOS ? (
              <button type="button" className="sn-boton sn-boton--primario sn-boton--lg" onClick={avanzar}>
                {t.siguiente}
                <Icono nombre="flechaDerecha" tam={16} />
              </button>
            ) : (
              <button
                type="submit"
                className="sn-boton sn-boton--primario sn-boton--lg"
                disabled={enviando}
              >
                {enviando ? t.enviando : t.enviar}
              </button>
            )}
          </div>
        </form>

        <p className="sn-registro__login">
          {t.yaTenesCuenta} <Link to="/panel/ingresar">{t.ingresarAlPanel}</Link>
        </p>
      </div>
    </div>
  );
}

export default RegistrarEstacionamiento;
