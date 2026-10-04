/**
 * Sesión del panel administrativo.
 *
 * Guarda el usuario logueado y lo revalida contra el servidor al levantar la
 * app: si mientras tanto lo desactivaron o le cambiaron el rol, el panel se
 * entera enseguida y no cuando expire el token.
 */
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { auth as servicioAuth } from '../services/spotnear.service.js';
import { tokens, alPerderSesion } from '../services/api.js';
import {
  anotarCierreAlCargar,
  avisarCierreDeSesion,
  olvidarActividad,
  registrarActividad,
  sesionVencidaPorInactividad,
} from '../hooks/useSesionPanel.js';

/**
 * Una sesión guardada que quedó más de 15 minutos sin uso (pestaña recargada
 * al día siguiente, navegador reabierto) no se retoma: se cierra antes de
 * mostrar nada. Ver hooks/useSesionPanel.js.
 */
function sesionGuardadaVigente() {
  if (!tokens.access) return false;
  if (!sesionVencidaPorInactividad()) return true;
  // logout() lee el refresh token antes de su primer await; la limpieza local
  // va enseguida, para que `revalidar` ya no encuentre el token.
  servicioAuth.logout().catch(() => {});
  tokens.limpiar();
  olvidarActividad();
  anotarCierreAlCargar('inactividad');
  return false;
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Arranca con lo que haya en localStorage para no parpadear en cada recarga.
  const [usuario, setUsuario] = useState(() => (sesionGuardadaVigente() ? tokens.usuario : null));
  const [cargando, setCargando] = useState(() => Boolean(tokens.access));

  /** Revalida la sesión contra el servidor. */
  const revalidar = useCallback(async () => {
    if (!tokens.access) {
      setUsuario(null);
      setCargando(false);
      return;
    }
    try {
      const actual = await servicioAuth.yo();
      setUsuario(actual);
    } catch {
      // Token vencido o usuario desactivado: se cierra la sesión en silencio.
      tokens.limpiar();
      setUsuario(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    revalidar();
  }, [revalidar]);

  // El cliente HTTP avisa cuando no pudo renovar la sesión.
  useEffect(() => alPerderSesion(() => setUsuario(null)), []);

  const ingresar = useCallback(async (email, password) => {
    const u = await servicioAuth.login(email, password);
    // La cuenta de inactividad de esta sesión arranca ahora, no con la marca
    // que haya dejado una sesión anterior.
    registrarActividad();
    setUsuario(u);
    return u;
  }, []);

  /**
   * Cierra la sesión.
   * @param {{ avisarOtrasPestanas?: boolean }} [opciones]
   *   Se avisa a las demás pestañas salvo que el cierre VENGA de otra pestaña,
   *   para no rebotar el mensaje de vuelta y hacer eco.
   */
  const salir = useCallback(async ({ avisarOtrasPestanas = true } = {}) => {
    // Primero se cierra acá, sin esperar al servidor: con el plan gratis de
    // Render el backend puede estar despertando y tardar un minuto en
    // contestar, y durante ese minuto el panel seguiría abierto. El logout del
    // servidor (revocar el refresh token) sale igual, en segundo plano.
    const cierreEnServidor = servicioAuth.logout();
    tokens.limpiar();
    olvidarActividad();
    setUsuario(null);
    if (avisarOtrasPestanas) avisarCierreDeSesion();
    await cierreEnServidor.catch(() => {});
  }, []);

  const valor = useMemo(
    () => ({
      usuario,
      cargando,
      autenticado: Boolean(usuario),
      rol: usuario?.role ?? null,
      esSuperadmin: usuario?.role === 'SUPERADMIN',
      esOwner: usuario?.role === 'OWNER',
      esStaff: usuario?.role === 'STAFF',
      /** ¿Puede configurar (tarifas, equipo, datos del estacionamiento)? */
      puedeConfigurar: usuario?.role === 'SUPERADMIN' || usuario?.role === 'OWNER',
      parkingId: usuario?.parkingId ?? null,
      parking: usuario?.parking ?? null,
      ingresar,
      salir,
      revalidar,
      setUsuario,
    }),
    [usuario, cargando, ingresar, salir, revalidar],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth tiene que usarse dentro de <AuthProvider>.');
  return ctx;
}

export default AuthContext;
