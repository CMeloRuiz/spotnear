/**
 * Ingreso al panel administrativo.
 */
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
import Logo from '../../components/layout/Logo.jsx';
import { Campo } from '../../components/ui/Campo.jsx';
import { Icono } from '../../components/ui/Iconos.jsx';
import { Aviso } from '../../components/ui/Varios.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTitulo } from '../../hooks/index.js';
import { validarLogin, sinErrores } from '../../utils/validaciones.js';
import textos from '../../i18n/textos.js';
import { leerCierreAlCargar, olvidarCierreAlCargar } from '../../hooks/useSesionPanel.js';
import './Login.css';

export function Login() {
  const { ingresar, autenticado, cargando } = useAuth();
  const navegar = useNavigate();
  const ubicacion = useLocation();

  useTitulo(textos.admin.login.titulo);

  const [form, setForm] = useState({ email: '', password: '' });
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [verPassword, setVerPassword] = useState(false);

  // El panel manda el motivo al redirigir: inactividad, cierre en otra
  // pestaña o cambio de contraseña (que cierra todas las sesiones).
  const MOTIVOS = {
    inactividad: 'cerradaPorInactividad',
    passwordCambiada: 'cerradaPorCambioDePassword',
  };
  // Si la sesión venció mientras la pestaña estaba cerrada o dormida, el
  // motivo no viene en la redirección sino anotado por AuthContext.
  const [motivoAlCargar] = useState(leerCierreAlCargar);
  useEffect(() => olvidarCierreAlCargar(), []);
  const motivo = ubicacion.state?.motivo ?? motivoAlCargar;
  const motivoCierre = motivo ? textos.admin.sesion[MOTIVOS[motivo] ?? 'cerradaEnOtraPestana'] : null;

  // Ya logueado: derecho al panel (o a donde quería ir antes).
  if (!cargando && autenticado) {
    return <Navigate to={ubicacion.state?.desde ?? '/panel'} replace />;
  }

  const set = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErrores((e) => (e[campo] ? { ...e, [campo]: undefined } : e));
    setErrorGeneral(null);
  };

  const enviar = async (e) => {
    e.preventDefault();

    const nuevos = validarLogin(form);
    setErrores(nuevos);
    if (!sinErrores(nuevos)) return;

    setEnviando(true);
    setErrorGeneral(null);

    try {
      await ingresar(form.email.trim(), form.password);
      navegar(ubicacion.state?.desde ?? '/panel', { replace: true });
    } catch (error) {
      // El backend no distingue email inexistente de clave incorrecta,
      // así que acá tampoco: se muestra su mensaje tal cual.
      setErrorGeneral(error.message ?? textos.admin.login.error);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="sn-login">
      <div className="sn-login__panel">
        <div className="sn-login__caja">
          <Logo tam="lg" className="sn-login__logo" />

          <header className="sn-login__cabecera">
            <h1 className="sn-login__titulo">{textos.admin.login.titulo}</h1>
            <p className="sn-login__subtitulo">{textos.admin.login.subtitulo}</p>
          </header>

          {/* El motivo del cierre se muestra solo hasta el primer intento:
              después manda el error del login, si lo hubo. */}
          {motivoCierre && !errorGeneral && <Aviso tipo="aviso">{motivoCierre}</Aviso>}
          {errorGeneral && <Aviso tipo="error">{errorGeneral}</Aviso>}

          <form className="sn-login__form" onSubmit={enviar} noValidate>
            <Campo
              type="email"
              name="email"
              label={textos.admin.login.email}
              placeholder="tucorreo@estacionamiento.com.ar"
              autoComplete="username"
              autoFocus
              obligatorio
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              error={errores.email}
            />

            <div className="sn-login__password">
              <Campo
                type={verPassword ? 'text' : 'password'}
                name="password"
                label={textos.admin.login.password}
                autoComplete="current-password"
                obligatorio
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                error={errores.password}
              />
              <button
                type="button"
                className="sn-login__ver"
                onClick={() => setVerPassword((v) => !v)}
                aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <Icono nombre={verPassword ? 'ojo' : 'ojoTachado'} tam={17} />
              </button>
            </div>

            <button
              type="submit"
              className="sn-boton sn-boton--primario sn-boton--lg sn-boton--bloque"
              disabled={enviando}
            >
              {enviando ? (
                <>
                  <span className="sn-spinner" style={{ width: 17, height: 17 }} aria-hidden="true" />
                  {textos.admin.login.ingresando}
                </>
              ) : (
                <>
                  <Icono nombre="candado" tam={17} />
                  {textos.admin.login.ingresar}
                </>
              )}
            </button>
          </form>

          <Link to="/" className="sn-login__volver">
            <Icono nombre="flechaIzquierda" tam={15} />
            {textos.admin.login.volverAlSitio}
          </Link>
        </div>
      </div>

      {/* Costado decorativo: solo en escritorio */}
      <aside className="sn-login__costado" aria-hidden="true">
        <div className="sn-login__costado-contenido">
          <h2>Tus reservas, ordenadas.</h2>
          <p>
            Todo lo que hoy llega por WhatsApp, en un solo lugar: quién llega, a qué hora, con qué
            auto y cuánto paga.
          </p>
          <ul>
            <li>
              <Icono nombre="checkCirculo" tam={18} /> Check-in por código o patente
            </li>
            <li>
              <Icono nombre="checkCirculo" tam={18} /> Control de capacidad automático
            </li>
            <li>
              <Icono nombre="checkCirculo" tam={18} /> Resumen del día para el grupo
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

export default Login;
