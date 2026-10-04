/**
 * Mi cuenta: por ahora, cambiar la contraseña propia.
 *
 * La ven los tres roles y cada uno cambia SOLO la suya: el backend toma el
 * usuario del token, nunca de un id que mande el formulario.
 *
 * Al cambiarla, el backend cierra todas las sesiones abiertas (por si alguien
 * más la conocía), así que después del cambio se vuelve a ingresar con la
 * nueva.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Campo, CampoCheck } from '../../components/ui/Campo.jsx';
import { Icono } from '../../components/ui/Iconos.jsx';
import { Aviso } from '../../components/ui/Varios.jsx';
import { auth } from '../../services/spotnear.service.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useTitulo } from '../../hooks/index.js';
import textos from '../../i18n/textos.js';

/** La misma regla mínima que exige el backend para cualquier contraseña. */
const LARGO_MINIMO = 8;

const VACIO = { actual: '', nueva: '', confirmacion: '' };

export function MiCuenta() {
  const t = textos.admin.cuenta;
  useTitulo(t.titulo);

  const { usuario, rol, salir } = useAuth();
  const toast = useToast();
  const navegar = useNavigate();

  const [form, setForm] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [verPasswords, setVerPasswords] = useState(false);

  const set = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErrores((e) => (e[campo] ? { ...e, [campo]: undefined } : e));
  };

  const validar = () => {
    const e = {};
    if (!form.actual) e.actual = t.faltaActual;
    if (form.nueva.length < LARGO_MINIMO) e.nueva = t.muyCorta(LARGO_MINIMO);
    else if (form.nueva === form.actual) e.nueva = t.igualALaActual;
    if (form.confirmacion !== form.nueva) e.confirmacion = t.noCoinciden;
    return e;
  };

  const guardar = async (ev) => {
    ev.preventDefault();
    const e = validar();
    setErrores(e);
    if (Object.keys(e).length > 0) return;

    setGuardando(true);
    try {
      await auth.cambiarPassword(form.actual, form.nueva);
      toast.ok(t.listo);
      // El servidor cerró todas las sesiones: se vuelve a ingresar con la nueva.
      await salir();
      navegar('/panel/ingresar', { replace: true, state: { motivo: 'passwordCambiada' } });
    } catch (error) {
      const deCampo = error.erroresDeCampo ?? {};
      if (Object.keys(deCampo).length > 0) setErrores(deCampo);
      else toast.error(error.message ?? textos.errores.generico);
    } finally {
      setGuardando(false);
    }
  };

  const tipo = verPasswords ? 'text' : 'password';

  return (
    <>
      <header className="sn-panel__cabecera">
        <div>
          <h1 className="sn-panel__titulo">{t.titulo}</h1>
          <p className="sn-panel__subtitulo">
            {usuario.nombre} · {usuario.email} · {textos.admin.roles[rol]}
          </p>
        </div>
      </header>

      <section className="sn-panel__seccion" style={{ maxWidth: 520 }}>
        <h2 className="sn-panel__seccion-titulo">{t.cambiarPassword}</h2>

        <form className="sn-form" onSubmit={guardar} noValidate>
          <Campo
            name="actual"
            type={tipo}
            label={t.actual}
            autoComplete="current-password"
            obligatorio
            value={form.actual}
            onChange={(e) => set('actual', e.target.value)}
            error={errores.actual}
          />
          <Campo
            name="nueva"
            type={tipo}
            label={t.nueva}
            autoComplete="new-password"
            obligatorio
            ayuda={t.ayudaNueva(LARGO_MINIMO)}
            value={form.nueva}
            onChange={(e) => set('nueva', e.target.value)}
            error={errores.nueva}
          />
          <Campo
            name="confirmacion"
            type={tipo}
            label={t.confirmacion}
            autoComplete="new-password"
            obligatorio
            value={form.confirmacion}
            onChange={(e) => set('confirmacion', e.target.value)}
            error={errores.confirmacion}
          />

          <CampoCheck
            label={t.mostrar}
            checked={verPasswords}
            onChange={(e) => setVerPasswords(e.target.checked)}
          />

          <Aviso tipo="info">{t.aviso}</Aviso>

          <div>
            <button type="submit" className="sn-boton sn-boton--primario" disabled={guardando}>
              {guardando ? (
                <span className="sn-spinner" style={{ width: 16, height: 16 }} aria-hidden="true" />
              ) : (
                <Icono nombre="candado" tam={17} />
              )}
              {guardando ? textos.comunes.guardando : t.guardar}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}

export default MiCuenta;
