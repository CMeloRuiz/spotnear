/**
 * Servicios de dominio: una función por caso de uso.
 *
 * Los componentes llaman a estas funciones y nunca arman URLs a mano.
 * Si el backend cambia una ruta, se toca solo este archivo.
 */
import api, { pedir, descargar, tokens } from './api.js';

/* ═══════════════════════════ Público ═══════════════════════════ */

export const publico = {
  /** Configuración del servidor (moneda, si hay pago online, etc.). */
  config: () => api.get('/config'),

  /**
   * Búsqueda de estacionamientos.
   * @param {object} filtros
   */
  buscarParkings: (filtros, { signal } = {}) =>
    api.get('/parkings', {
      signal,
      params: {
        lat: filtros.lat,
        lng: filtros.lng,
        radio: filtros.radio,
        inicio: filtros.inicio,
        fin: filtros.fin,
        modalidad: filtros.modalidad,
        tipoVehiculo: filtros.tipoVehiculo,
        cubierto: filtros.cubierto,
        precioMax: filtros.precioMax,
        calificacionMin: filtros.calificacionMin,
        servicios: filtros.servicios?.length ? filtros.servicios.join(',') : undefined,
        cantidadVehiculos: filtros.cantidadVehiculos,
        orden: filtros.orden,
        // También los que no tienen lugar en ese horario: la tarjeta lo dice
        // ("Sin disponibilidad en este horario") en vez de que desaparezcan sin
        // explicación. El backend los manda al final de la lista.
        soloDisponibles: 'false',
      },
    }),

  /** Detalle de un estacionamiento. Con inicio/fin trae precio y disponibilidad. */
  detalleParking: (idOSlug, params, { signal } = {}) =>
    api.get(`/parkings/${encodeURIComponent(idOSlug)}`, { params, signal }),

  /** Cotización sin crear nada. */
  cotizar: (parkingId, datos, { signal } = {}) =>
    api.post(`/parkings/${encodeURIComponent(parkingId)}/cotizar`, datos, { signal }),

  /** Crea la reserva como invitado. Devuelve el comprobante completo. */
  crearReserva: (datos) => api.post('/reservations', datos),

  /** Comprobante público por token. */
  comprobante: (token, { signal } = {}) =>
    api.get(`/reservations/comprobante/${encodeURIComponent(token)}`, { signal }),

  /**
   * Estado del cobro de la seña.
   *
   * No es una consulta pasiva: el servidor le pregunta a Mercado Pago y, si el
   * pago está aprobado, confirma la reserva y dispara el comprobante y el aviso
   * al estacionamiento en ese momento. Por eso la pantalla de pago la llama
   * cada tantos segundos en vez de esperar sentada al webhook.
   */
  estadoPago: (token, { signal } = {}) =>
    api.get(`/reservations/comprobante/${encodeURIComponent(token)}/pago`, { signal }),

  /**
   * Arma el checkout de la seña y devuelve el link. Lo dispara el botón "Pagar
   * la seña" (la primera vez y en cada reintento): es el único camino a la
   * pasarela, así que nada manda al cliente ahí sin que él lo haya pedido.
   */
  pagarSena: (token) =>
    api.post(`/reservations/comprobante/${encodeURIComponent(token)}/pagar-sena`, {}),

  /** URL del QR en SVG (para imprimir). */
  urlQrSvg: (token) =>
    `${import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1'}/reservations/comprobante/${encodeURIComponent(token)}/qr.svg`,

  /** Catálogo de marca/modelo/tipo, para el autocompletado del checkout. */
  catalogoVehiculos: ({ signal } = {}) => api.get('/vehiculos/catalogo', { signal }),

  /** Tipo de vehículo según marca y modelo: { coincidencia: { tipo, marca, modelo } | null }. */
  clasificarVehiculo: (marca, modelo) => api.get('/vehiculos/clasificar', { params: { marca, modelo } }),

  /** Manda la imagen del comprobante al WhatsApp que el cliente cargó en la reserva. */
  enviarComprobantePorWhatsApp: (token) =>
    api.post(`/reservations/comprobante/${encodeURIComponent(token)}/enviar-whatsapp`, {}),

  /** Reenvía el comprobante por email. */
  enviarComprobantePorEmail: (token, email) =>
    api.post(`/reservations/comprobante/${encodeURIComponent(token)}/enviar-email`, { email }),

  /**
   * Sube fotos del estacionamiento y devuelve sus URLs.
   * Se llama apenas el dueño elige los archivos, antes de mandar el formulario.
   * @param {File[]} archivos
   */
  subirFotosParking: (archivos) => {
    const cuerpo = new FormData();
    for (const a of archivos) cuerpo.append('fotos', a);
    // Timeout más largo que el resto: son varios megas por una conexión móvil.
    return pedir('/onboarding/fotos', { method: 'POST', body: cuerpo, timeout: 120_000 });
  },

  /**
   * Solicitud pública de alta de un estacionamiento.
   * Crea el dueño y el estacionamiento en estado pendiente de aprobación.
   */
  registrarEstacionamiento: (datos) => api.post('/onboarding/parkings', datos),
};

/* ═══════════════════════════ Auth ═══════════════════════════ */

export const auth = {
  async login(email, password) {
    const datos = await api.post('/auth/login', { email, password });
    tokens.guardar(datos);
    return datos.usuario;
  },

  async logout() {
    // Se lee el refresh token ANTES de cualquier await: quien llama puede
    // limpiar la sesión local enseguida, sin esperar esta respuesta.
    const refreshToken = tokens.refresh;
    try {
      if (refreshToken) await api.post('/auth/logout', { refreshToken });
    } finally {
      // Aunque el servidor no responda, la sesión local se cierra igual. Salvo
      // que mientras tanto se haya iniciado OTRA sesión: esa no se toca.
      if (tokens.refresh === refreshToken) tokens.limpiar();
    }
  },

  async yo() {
    const { usuario } = await api.get('/auth/me', { auth: true });
    tokens.guardar({ usuario });
    return usuario;
  },

  actualizarPerfil: (datos) => api.patch('/auth/me', datos, { auth: true }),

  cambiarPassword: (actual, nueva) =>
    api.post('/auth/cambiar-password', { actual, nueva }, { auth: true }),
};

/* ═══════════════════════════ Panel ═══════════════════════════ */

const conAuth = { auth: true };

export const admin = {
  /* ── Catálogo de vehículos (SUPERADMIN) ── */
  catalogoVehiculos: {
    listar: ({ signal } = {}) => api.get('/admin/vehiculos-catalogo', { ...conAuth, signal }),
    crear: (datos) => api.post('/admin/vehiculos-catalogo', datos, conAuth),
    editar: (id, datos) =>
      api.patch(`/admin/vehiculos-catalogo/${encodeURIComponent(id)}`, datos, conAuth),
    eliminar: (id) => api.delete(`/admin/vehiculos-catalogo/${encodeURIComponent(id)}`, conAuth),
  },

  /* ── Reservas ── */
  reservas: {
    /** Reservas confirmadas que el usuario todavía no vio (contador del menú). */
    nuevas: ({ signal } = {}) => api.get('/admin/reservations/nuevas', { ...conAuth, signal }),

    /** Marca las reservas nuevas como vistas (al abrir la lista). */
    marcarVistas: () => api.post('/admin/reservations/vistas', {}, conAuth),

    /** Corrige el tipo de vehículo (en el check-in) y ajusta lo que se paga en el lugar. */
    cambiarVehiculo: (id, tipo) =>
      api.patch(`/admin/reservations/${encodeURIComponent(id)}/vehiculo`, { tipo }, conAuth),

    /** Quita del panel una reserva terminada (borrado lógico). */
    eliminar: (id) => api.delete(`/admin/reservations/${encodeURIComponent(id)}`, conAuth),
    listar: (filtros, { signal } = {}) =>
      api.get('/admin/reservations', { ...conAuth, signal, params: filtros }),

    detalle: (id, { signal } = {}) =>
      api.get(`/admin/reservations/${encodeURIComponent(id)}`, { ...conAuth, signal }),

    crear: (datos) => api.post('/admin/reservations', datos, conAuth),

    editar: (id, datos) =>
      api.patch(`/admin/reservations/${encodeURIComponent(id)}`, datos, conAuth),

    /** accion ∈ check-in | check-out | confirmar | cancelar | no-show */
    accion: (id, accion, body = {}) =>
      api.post(`/admin/reservations/${encodeURIComponent(id)}/${accion}`, body, conAuth),

    buscarRapido: (q, { signal } = {}) =>
      api.get('/admin/reservations/buscar', { ...conAuth, signal, params: { q } }),

    whatsapp: (id, destino = 'grupo') =>
      api.get(`/admin/reservations/${encodeURIComponent(id)}/whatsapp`, {
        ...conAuth,
        params: { destino },
      }),

    resumenDia: (fecha) =>
      api.get('/admin/reservations/resumen-dia', { ...conAuth, params: { fecha } }),

    exportarCSV: (filtros) =>
      descargar('/admin/reservations/exportar.csv', {
        params: filtros,
        nombrePorDefecto: 'reservas-spotnear.csv',
      }),
  },

  /* ── Estacionamientos ── */
  parkings: {
    listar: (params, { signal } = {}) => api.get('/admin/parkings', { ...conAuth, signal, params }),
    detalle: (id, { signal } = {}) =>
      api.get(`/admin/parkings/${encodeURIComponent(id)}`, { ...conAuth, signal }),
    crear: (datos) => api.post('/admin/parkings', datos, conAuth),
    editar: (id, datos) => api.patch(`/admin/parkings/${encodeURIComponent(id)}`, datos, conAuth),
    /**
     * Eliminación permanente. Pide el nombre exacto en el body: el backend lo
     * vuelve a validar, así que no alcanza con saltearse el modal.
     */
    eliminarDefinitivo: (id, datos) =>
      api.delete(`/admin/parkings/${encodeURIComponent(id)}/definitivo`, { ...conAuth, body: datos }),
    darDeBaja: (id) => api.delete(`/admin/parkings/${encodeURIComponent(id)}`, conAuth),

    agregarFoto: (id, datos) => api.post(`/admin/parkings/${encodeURIComponent(id)}/fotos`, datos, conAuth),
    borrarFoto: (id, fotoId) =>
      api.delete(`/admin/parkings/${encodeURIComponent(id)}/fotos/${encodeURIComponent(fotoId)}`, conAuth),

    campos: (id) => api.get(`/admin/parkings/${encodeURIComponent(id)}/campos`, conAuth),
    crearCampo: (id, datos) => api.post(`/admin/parkings/${encodeURIComponent(id)}/campos`, datos, conAuth),
    editarCampo: (id, campoId, datos) =>
      api.patch(
        `/admin/parkings/${encodeURIComponent(id)}/campos/${encodeURIComponent(campoId)}`,
        datos,
        conAuth,
      ),
    borrarCampo: (id, campoId) =>
      api.delete(
        `/admin/parkings/${encodeURIComponent(id)}/campos/${encodeURIComponent(campoId)}`,
        conAuth,
      ),

    bloqueos: (id) => api.get(`/admin/parkings/${encodeURIComponent(id)}/bloqueos`, conAuth),
    crearBloqueo: (id, datos) =>
      api.post(`/admin/parkings/${encodeURIComponent(id)}/bloqueos`, datos, conAuth),
    borrarBloqueo: (id, bloqueoId) =>
      api.delete(
        `/admin/parkings/${encodeURIComponent(id)}/bloqueos/${encodeURIComponent(bloqueoId)}`,
        conAuth,
      ),
  },

  /* ── Tarifas ── */
  tarifas: {
    listar: (params, { signal } = {}) => api.get('/admin/rates', { ...conAuth, signal, params }),
    crear: (datos) => api.post('/admin/rates', datos, conAuth),
    editar: (id, datos) => api.patch(`/admin/rates/${encodeURIComponent(id)}`, datos, conAuth),
    desactivar: (id) => api.delete(`/admin/rates/${encodeURIComponent(id)}`, conAuth),
  },

  /* ── Solicitudes de alta (solo SUPERADMIN) ── */
  solicitudes: {
    listar: (params, { signal } = {}) => api.get('/admin/onboarding', { ...conAuth, signal, params }),
    /** Solo el número de pendientes, para el badge del menú. */
    pendientes: ({ signal } = {}) => api.get('/admin/onboarding/pendientes', { ...conAuth, signal }),
    aprobar: (id, datos = {}) =>
      api.post(`/admin/onboarding/${encodeURIComponent(id)}/aprobar`, datos, conAuth),
    rechazar: (id, datos = {}) =>
      api.post(`/admin/onboarding/${encodeURIComponent(id)}/rechazar`, datos, conAuth),
  },

  /* ── Equipo ── */
  equipo: {
    listar: (params, { signal } = {}) => api.get('/admin/staff', { ...conAuth, signal, params }),
    crear: (datos) => api.post('/admin/staff', datos, conAuth),
    editar: (id, datos) => api.patch(`/admin/staff/${encodeURIComponent(id)}`, datos, conAuth),
    darDeBaja: (id) => api.delete(`/admin/staff/${encodeURIComponent(id)}`, conAuth),
    /** Borrado real de la fila, distinto de la baja lógica. */
    eliminar: (id) =>
      api.delete(`/admin/staff/${encodeURIComponent(id)}/definitivo`, { ...conAuth, body: {} }),
  },

  /* ── Reportes ── */
  reportes: {
    dashboard: (params, { signal } = {}) =>
      api.get('/admin/reports/dashboard', { ...conAuth, signal, params }),
    comisiones: (params, { signal } = {}) =>
      api.get('/admin/reports/comisiones', { ...conAuth, signal, params }),
    exportarComisiones: (params) =>
      descargar('/admin/reports/comisiones.csv', {
        params,
        nombrePorDefecto: 'comisiones-spotnear.csv',
      }),
  },
};

export { pedir, tokens };
export default { publico, auth, admin };
