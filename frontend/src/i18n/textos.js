/**
 * Textos de la interfaz, centralizados.
 *
 * Español de Argentina con voseo ("Reservá", "Ingresá", "Estacioná").
 * Están todos acá para poder internacionalizar más adelante sin salir a
 * buscar strings por todo el código: bastaría con agregar otro objeto y
 * un selector de idioma.
 */

export const textos = {
  marca: {
    nombre: 'SpotNear',
    empresa: 'ColdevIA',
    tagline: 'Estacioná fácil, donde vayas',
    descripcion:
      'Reservá tu lugar antes de salir. Sin vueltas, sin dar vueltas a la manzana.',
  },

  nav: {
    inicio: 'Inicio',
    tenesEstacionamiento: '¿Tenés un estacionamiento?',
    sobreNosotros: 'Sobre nosotros',
    ingresar: 'Ingresar',
    panel: 'Mi panel',
    salir: 'Cerrar sesión',
    buscar: 'Buscar estacionamientos',
    menu: 'Abrir menú',
    cerrarMenu: 'Cerrar menú',
  },

  home: {
    titulo: 'Estacioná fácil, donde quiera que vayas',
    subtitulo:
      'Reservá tu lugar en estacionamientos de Buenos Aires. Elegí, reservá y llegá tranquilo.',
    heroAlt: 'Interior de un estacionamiento cubierto con autos estacionados',
    comoFunciona: 'Cómo funciona',
    comoFuncionaSubtitulo: 'Tres pasos y listo. No hace falta crear cuenta.',
    pasos: [
      {
        titulo: 'Buscá',
        texto: 'Escribí a dónde vas y cuándo. Te mostramos los estacionamientos cerca, con precio final.',
      },
      {
        titulo: 'Reservá',
        texto: 'Cargás tus datos y los del vehículo en un minuto. No necesitás tarjeta ni registrarte.',
      },
      {
        titulo: 'Llegá y estacioná',
        texto: 'Ya está pagado: mostrás el código o el QR al entrar y listo. Tu lugar te está esperando.',
      },
    ],
    zonas: 'Zonas donde ya estamos',
    zonasSubtitulo: 'Seguimos sumando estacionamientos en toda la ciudad.',
    confianza: [
      { titulo: 'Cancelación gratuita', texto: 'Hasta la hora de inicio, sin costo ni vueltas.' },
      { titulo: 'Precio final', texto: 'Lo que ves es lo que pagás. Sin cargos escondidos.' },
      { titulo: 'Señás y listo', texto: 'Pagás una seña online para apartar el lugar y el resto en el estacionamiento.' },
    ],
  },

  busqueda: {
    porHora: 'Por hora / Diario',
    // La segunda pestaña del hero volvió a llamarse "Mensual" y quedó pausada.
    // Estas tres claves son del formulario de eventos, que sigue armado detrás
    // de esa pestaña esperando que se reactive; `eventos` es su etiqueta.
    eventos: 'Eventos',
    fechaDelEvento: 'Fecha del evento',
    elegiSede: 'Elegí a qué evento vas',
    pestanaPausada: 'La reserva mensual todavía no está disponible',
    mensual: 'Mensual',
    desdeMensual: 'Inicio del abono',
    sitiosCargando: 'Cargando sitios...',
    sitiosError: 'No pudimos cargar los sitios. Probá con la búsqueda por dirección.',
    aDondeVas: '¿A dónde vas?',
    placeholderDireccion: 'Dirección, barrio o lugar',
    desde: 'Ingreso',
    hasta: 'Salida',
    buscar: 'Buscar estacionamientos',
    // Versión corta para el botón de la barra de resultados, donde no entra la frase.
    buscarBoton: 'Buscar',
    buscando: 'Buscando...',
    ubicacionActual: 'Usar mi ubicación',
    obteniendoUbicacion: 'Buscando tu ubicación...',
    sinUbicacion: 'No pudimos obtener tu ubicación. Escribí la dirección a mano.',
    elegiDestino: 'Elegí a dónde vas para poder buscar.',
    sugerencias: 'Sugerencias de direcciones',
    lugaresConocidos: 'Lugares conocidos',
    mensualAviso:
      'La reserva mensual está en etapa de consulta: elegís el estacionamiento y te contactamos para cerrarla.',
  },

  resultados: {
    titulo: 'Estacionamientos disponibles',
    encontrados: (n) => `${n} ${n === 1 ? 'estacionamiento' : 'estacionamientos'}`,
    cargando: 'Buscando lugares disponibles...',
    sinResultados: 'No encontramos estacionamientos',
    sinResultadosTexto:
      'Probá ampliar el radio de búsqueda, cambiar el horario o sacar algún filtro.',
    limpiarFiltros: 'Limpiar filtros',
    filtros: 'Filtros',
    aplicarFiltros: 'Aplicar',
    ordenarPor: 'Ordenar por',
    orden: {
      RELEVANCIA: 'Relevancia',
      PRECIO: 'Precio',
      DISTANCIA: 'Distancia',
      CALIFICACION: 'Calificación',
    },
    tipoVehiculo: 'Tipo de vehículo',
    cubierto: 'Cubierto',
    descubierto: 'Descubierto',
    techado: 'Techado / Cubierto',
    precioMaximo: 'Precio máximo',
    distanciaMaxima: 'Distancia máxima',
    calificacionMinima: 'Calificación mínima',
    servicios: 'Servicios',
    mostrarTotal: 'Mostrar precio total de la estadía',
    mostrarMediaEstadia: 'Mostrar precio de la media estadía',
    mostrarEstadiaCompleta: 'Mostrar precio de la estadía completa',
    mostrarTotalAyuda:
      'Activado ves el total de tu reserva. Desactivado, el precio por hora del estacionamiento.',
    verMapa: 'Ver mapa',
    verLista: 'Ver lista',
    buscarEnEstaZona: 'Buscar en esta zona',
    reservar: 'Reservar',
    porHora: 'por hora',
    total: 'Total',
    desde: 'Desde',
    precioParaAuto: 'Precio para auto · varía según el vehículo',
    caminando: (min) => `${min} min caminando`,
    lugaresLibres: (n) =>
      n === 1 ? 'Queda 1 lugar' : n <= 5 ? `Quedan ${n} lugares` : `${n} lugares disponibles`,
    // Leyenda de cupos de la tarjeta. La disponibilidad es para el horario
    // buscado (descuenta las reservas que se superponen), no para "ahora".
    capacidad: (total) => (total === 1 ? '1 lugar' : `${total} lugares`),
    disponibles: (n) =>
      n === 1 ? '1 disponible en tu horario' : `${n} disponibles en tu horario`,
    sinDisponibilidad: 'Sin disponibilidad en este horario',
    ultimosLugares: '¡Últimos lugares!',
    etiquetas: {
      MAS_CERCA: 'Más cerca',
      MAS_BARATO: 'Más barato',
      MEJOR_CALIFICADO: 'Mejor calificado',
    },
    sinCalificacion: 'Sin calificaciones',
  },

  parking: {
    volver: 'Volver a los resultados',
    sobreElLugar: 'Sobre el lugar',
    serviciosTitulo: 'Servicios',
    horarios: 'Horarios de atención',
    abierto24h: 'Abierto las 24 horas, todos los días',
    abierto24hCorto: 'Abierto 24 h',
    cerrado: 'Cerrado',
    sinDato: 'Consultar',
    desde: (hora) => `Desde ${hora}`,
    desdeHastaEvento: (hora) => `${hora} · hasta que termine el evento`,
    cierreEventoResumen: 'Cierra cuando termina el evento',
    // Leyenda de la tarjeta de resultados (utils/horarios.js → leyendaHorario).
    abreA: (hora) => `Abre ${hora}`,
    cierraA: (hora) => `Cierra ${hora}`,
    cierraConEvento: 'Cierra al finalizar el evento',
    cerradoEseDia: 'Cerrado ese día',
    horarioFijoResumen: 'Horario fijo',
    modosHorario: {
      FIJO: 'Horario fijo',
      ABIERTO_24HS: 'Abierto las 24 horas',
      FIN_EVENTO: 'Cerramos cuando termina el evento',
    },
    capacidad: 'Capacidad',
    lugares: (n) => `${n} ${n === 1 ? 'lugar' : 'lugares'}`,
    alturaMaxima: 'Altura máxima',
    vehiculosAceptados: 'Vehículos que acepta',
    ubicacion: 'Ubicación',
    comoLlegar: 'Cómo llegar',
    tarifasTitulo: 'Tarifas',
    reservarAca: 'Reservar en este estacionamiento',
    noDisponible: 'Sin lugares en ese horario',
    servicios: {
      camaras: 'Cámaras de seguridad',
      '24hs': 'Abierto 24 horas',
      vigilancia: 'Vigilancia',
      techado: 'Techado',
      lavado: 'Lavadero',
      valet: 'Servicio de valet',
      cargador_electrico: 'Cargador para autos eléctricos',
    },
    tiposVehiculo: {
      AUTO: 'Auto',
      CAMIONETA: 'Camioneta',
      SUV: 'SUV',
      MOTO: 'Moto',
      UTILITARIO: 'Utilitario',
    },
  },

  checkout: {
    // De cara al cliente esto es una SEÑA para apartar el lugar, nunca una
    // comisión de SpotNear: esa palabra vive solo en el panel.
    enElEstacionamiento: 'Estacionamiento (lo pagás allá)',
    sena: 'Seña para reservar',
    senaAclaracion: 'No reembolsable · se paga ahora',
    totalReserva: 'Total de tu reserva',
    senaAviso:
      'Tu lugar queda reservado cuando se acredita la seña. La seña no se devuelve, ni siquiera si cancelás. El resto se lo pagás al estacionamiento cuando llegues.',
    pagoSimulado: 'Modo de prueba: no se cobra de verdad.',
    titulo: 'Terminá tu reserva',
    invitado: 'Estás reservando como invitado, no hace falta crear cuenta.',
    paso1: 'Tus datos',
    paso2: 'Confirmación',
    datosCliente: 'Datos del cliente',
    datosVehiculo: 'Datos del vehículo',
    opcionales: 'Datos opcionales',
    opcionalesAyuda: 'No son obligatorios, pero al estacionamiento le sirven.',
    nombre: 'Nombre',
    apellido: 'Apellido',
    telefono: 'Teléfono',
    telefonoAyuda: 'Te mandamos el comprobante por WhatsApp a este número.',
    email: 'Email',
    emailAyuda: 'Opcional. Si lo dejás, también te lo mandamos por mail.',
    // Con Mercado Pago el email es obligatorio: lo necesita para procesar el pago.
    emailAyudaPago: 'Mercado Pago lo necesita para el pago de la seña. Ahí te llega el recibo y el comprobante.',
    emailObligatorio: 'Ingresá tu email: Mercado Pago lo necesita para procesar el pago de la seña.',
    patente: 'Patente',
    patenteAyuda: 'Formato viejo (ABC123) o Mercosur (AB123CD).',
    tipoVehiculo: 'Tipo de vehículo',
    marca: 'Marca',
    modelo: 'Modelo',
    color: 'Color',
    // Detección del tipo con el catálogo de marca/modelo de SpotNear.
    elegiTipoVehiculo: 'Elegí el tipo de vehículo',
    tipoDetectado: (vehiculo) => `Lo detectamos por ${vehiculo}.`,
    tipoDetectadoNoAceptado: (tipo, vehiculo) =>
      `Un ${vehiculo} es ${tipo.toLowerCase()}, y este estacionamiento no recibe ese tipo de vehículo.`,
    tipoSinDetectar: 'Completá la marca y el modelo y lo detectamos.',
    // Resumen de precio: para qué vehículo es la tarifa.
    tarifaPara: (tipo) => `Tarifa para: ${tipo}`,
    tarifaReferencia: 'Tarifa de referencia: elegí tu tipo de vehículo',
    cantidadVehiculos: 'Cantidad de vehículos',
    notas: 'Notas o comentarios',
    notasPlaceholder: 'Ej: llego con una camioneta alta, necesito lugar en planta baja.',
    continuar: 'Continuar',
    volver: 'Volver',
    revisa: 'Revisá que esté todo bien',
    confirmar: 'Confirmar y pagar la seña',
    confirmando: 'Confirmando tu reserva...',
    // Cuando no hay credenciales de la pasarela cargadas. Se avisa antes de que
    // el cliente llene el formulario, no después de apretar el botón.
    pagoNoDisponible:
      'El pago en línea no está disponible en este momento. Probá de nuevo más tarde.',
    yendoAPagar: 'Te llevamos a pagar la seña...',
    resumen: 'Resumen',
    periodo: 'Período de reserva',
    desglose: 'Detalle del precio',
    subtotal: 'Subtotal',
    total: 'Total',
    pagado: 'Pagado',
    cancelacionGratis: 'Cancelás el lugar sin costo hasta la hora de inicio',
    errorGeneral: 'No pudimos confirmar tu reserva. Revisá los datos e intentá de nuevo.',
    sinCupo:
      'Se ocupó el último lugar mientras completabas los datos. Probá con otro horario u otro estacionamiento.',
    volverABuscar: 'Volver a buscar',
  },

  /**
   * Pantalla de pago de la seña (/pago/:token).
   *
   * Es la que se ve entre el checkout y el comprobante. Los tres estados dicen
   * cosas muy distintas y no se pueden confundir: "falta pagar" es una acción
   * pendiente del cliente, "estamos confirmando" es esperar sin hacer nada, y
   * "no se completó" es reintentar. Un pago en efectivo puede tardar horas en
   * acreditarse.
   *
   * Regla de redacción: antes de que la seña se acredite, NUNCA se dice que el
   * lugar está apartado o reservado. Recién con el pago acreditado lo está.
   */
  pago: {
    titulo: 'Pago de la seña',
    reserva: 'Reserva',

    // Recién vuelto de Mercado Pago, mientras se verifica el pago (unos segundos).
    consultando: 'Consultando tu reserva...',
    confirmandoTitulo: 'Confirmando tu pago...',
    confirmandoTexto: 'Estamos verificando con Mercado Pago que la seña se haya acreditado. Es solo un momento.',

    esperandoTitulo: 'Tu pago está en proceso',
    esperandoTexto:
      'Mercado Pago todavía no nos confirmó la acreditación. Si pagaste en efectivo o con transferencia puede tardar un rato. Tu comprobante va a estar disponible apenas se confirme.',
    esperandoNota:
      'Podés quedarte en esta pantalla, que se actualiza sola, o volver más tarde con este mismo link. Cuando se acredite, tu lugar queda reservado y te mandamos el comprobante.',
    revisarDeNuevo: 'Revisar de nuevo',
    copiarLink: 'Copiar el link de esta pantalla',

    faltaPagarTitulo: 'Falta pagar la seña',
    faltaPagarTexto:
      'Para reservar tu lugar, pagá la seña ahora. Es lo único que se paga online: el resto se lo pagás al estacionamiento al llegar.',
    irAPagar: 'Pagar la seña',
    // Modo sin vuelta automática (desarrollo local): Mercado Pago se abre en otra pestaña.
    terminaEnLaOtraPestana:
      'Abrimos Mercado Pago en otra pestaña. Terminá el pago ahí y volvé: esta pantalla se actualiza sola y te muestra el comprobante apenas se acredite.',
    reabrirMercadoPago: 'Volver a abrir Mercado Pago',

    rechazadoTitulo: 'El pago no se completó',
    rechazadoTexto:
      'Mercado Pago no pudo acreditar la seña, así que la reserva todavía no está confirmada. No se te cobró nada. Podés intentar de nuevo con otro medio de pago.',
    reintentar: 'Intentar de nuevo',

    listoTitulo: '¡Se acreditó la seña!',
    listoTexto: 'Te llevamos a tu comprobante...',

    senaLinea: 'Seña a pagar ahora',
    senaLineaPagada: 'Seña',
    restoLinea: 'A pagar en el estacionamiento',
    verComprobante: 'Ver mi comprobante',
    volverAlInicio: 'Volver al inicio',
    errorConsulta: 'No pudimos consultar el estado de tu pago. Probá recargando la pantalla.',
    // Se muestra cuando el cliente ya esperó bastante y conviene que se vaya
    // tranquilo: el comprobante le va a llegar igual por WhatsApp y por mail.
    tardaMucho:
      'Está tardando más de lo normal. Podés cerrar esta pantalla y volver más tarde con este mismo link: cuando la seña se acredite, tu comprobante va a estar acá.',
  },

  comprobante: {
    titulo: '¡Listo! Tu lugar está reservado',
    subtitulo: 'Guardá este comprobante: te lo van a pedir al entrar.',
    codigoReserva: 'Código de reserva',
    presenta: 'Presentá este comprobante al ingresar al estacionamiento',
    estacionamiento: 'Estacionamiento',
    direccion: 'Dirección',
    ingreso: 'Ingreso',
    salida: 'Salida',
    aNombreDe: 'A nombre de',
    telefono: 'Teléfono',
    vehiculo: 'Vehículo',
    patente: 'Patente',
    enElEstacionamiento: 'A pagar en el estacionamiento',
    sena: 'Seña (ya pagada)',
    total: 'Total de la reserva',
    aclaracionSena: 'La seña ya está paga y no es reembolsable. El resto se lo abonás al estacionamiento al llegar.',
    estado: 'Estado',
    pagoPendiente: 'Pago pendiente',
    pagado: 'Pagado',
    notas: 'Notas',
    comoLlegar: 'Cómo llegar',
    enviarWhatsApp: 'Enviar a mi WhatsApp',
    enviarEmail: 'Enviar por email',
    descargarPDF: 'Descargar PDF',
    guardarImagen: 'Guardar imagen',
    compartir: 'Compartir',
    copiarLink: 'Copiar link',
    linkCopiado: '¡Link copiado!',
    emailEnviado: 'Te lo mandamos por email.',
    emailPedirDireccion: '¿A qué email lo mandamos?',
    enviar: 'Enviar',
    enviando: 'Enviando...',
    cancelada: 'Esta reserva fue cancelada.',
    volverAlInicio: 'Volver al inicio',
    noEncontrado: 'No encontramos este comprobante',
    noEncontradoTexto:
      'El link puede estar incompleto o la reserva puede haber sido eliminada. Revisá el link que te enviamos.',
  },

  admin: {
    // Catálogo propio de marca/modelo → tipo de vehículo (SUPERADMIN).
    catalogo: {
      titulo: 'Catálogo de vehículos',
      subtitulo:
        'Con esta lista el checkout detecta el tipo de vehículo cuando el cliente escribe la marca y el modelo, y le cotiza la tarifa que corresponde. Si aparece un modelo que no reconoce, agregalo acá.',
      agregar: 'Agregar modelo',
      agregarTitulo: 'Agregar un modelo',
      editarTitulo: 'Editar modelo',
      buscar: 'Buscar',
      marca: 'Marca',
      modelo: 'Modelo',
      tipo: 'Tipo de vehículo',
      acciones: 'Acciones',
      editar: 'Editar',
      eliminar: 'Eliminar',
      ayudaModelo:
        'Sin la versión: "Hilux" alcanza para "Hilux SRV 4x4". Si un modelo tiene variantes de distinto tipo ("Corolla" y "Corolla Cross"), cargá las dos.',
      cantidad: (visibles, total) =>
        visibles === total ? `${total} modelos` : `${visibles} de ${total} modelos`,
      vacio: 'No hay modelos',
      vacioTexto: 'Agregá el primero con "Agregar modelo".',
      vacioFiltro: 'Ningún modelo coincide con la búsqueda.',
      agregado: (nombre) => `Se agregó ${nombre}.`,
      editado: 'Modelo actualizado.',
      eliminado: (nombre) => `Se eliminó ${nombre} del catálogo.`,
      eliminarTitulo: (nombre) => `¿Eliminar ${nombre}?`,
      eliminarTexto:
        'Desde ahora el checkout no va a detectar el tipo de este modelo: el cliente lo va a tener que elegir a mano. Las reservas ya hechas no cambian.',
    },
    // Mi cuenta: por ahora, solo cambiar la contraseña propia.
    cuenta: {
      titulo: 'Mi cuenta',
      cambiarPassword: 'Cambiar contraseña',
      actual: 'Contraseña actual',
      nueva: 'Contraseña nueva',
      confirmacion: 'Repetí la contraseña nueva',
      ayudaNueva: (n) => `Al menos ${n} caracteres. Usá una que no uses en otro lado.`,
      mostrar: 'Mostrar las contraseñas',
      guardar: 'Cambiar contraseña',
      aviso: 'Al cambiarla se cierran todas tus sesiones abiertas, incluida esta: vas a volver a ingresar con la nueva.',
      faltaActual: 'Ingresá tu contraseña actual.',
      muyCorta: (n) => `Tiene que tener al menos ${n} caracteres.`,
      igualALaActual: 'Tiene que ser distinta de la actual.',
      noCoinciden: 'Las dos contraseñas nuevas no coinciden.',
      listo: 'Contraseña actualizada.',
    },
    login: {
      titulo: 'Panel de administración',
      subtitulo: 'Ingresá con tu usuario para ver las reservas de tu estacionamiento.',
      email: 'Email',
      password: 'Contraseña',
      ingresar: 'Ingresar',
      ingresando: 'Ingresando...',
      error: 'No pudimos ingresar. Revisá tu email y tu contraseña.',
      volverAlSitio: 'Volver al sitio',
    },
    nav: {
      dashboard: 'Inicio',
      reservas: 'Reservas',
      miEstacionamiento: 'Mi estacionamiento',
      estacionamientos: 'Estacionamientos',
      tarifas: 'Tarifas',
      solicitudes: 'Solicitudes',
      equipo: 'Equipo',
      comisiones: 'Comisiones',
      catalogoVehiculos: 'Catálogo de vehículos',
      miCuenta: 'Mi cuenta',
      contraerMenu: 'Contraer menú',
      expandirMenu: 'Expandir menú',
      verSitio: 'Ver el sitio',
      reservasNuevas: (n) => (n === 1 ? '1 reserva nueva' : `${n} reservas nuevas`),
    },
    sesion: {
      cerradaPorInactividad: 'Tu sesión se cerró por inactividad. Volvé a ingresar.',
      cerradaEnOtraPestana: 'Cerraste sesión en otra pestaña.',
      cerradaPorCambioDePassword: 'Cambiaste tu contraseña: ingresá de nuevo con la nueva.',
      avisoTitulo: '¿Seguís ahí?',
      avisoTexto: (segundos) =>
        `Tu sesión está por cerrarse por inactividad en ${segundos} segundo${segundos === 1 ? '' : 's'}.`,
      avisoSeguir: 'Sigo acá',
      avisoSalir: 'Cerrar sesión ahora',
    },
    roles: {
      SUPERADMIN: 'Administrador de la plataforma',
      OWNER: 'Dueño',
      STAFF: 'Playero',
    },
    dashboard: {
      titulo: 'Hola',
      hoy: 'Hoy',
      reservasHoy: 'Reservas de hoy',
      ingresosPrevistos: 'Ingresos previstos',
      netoPrevisto: 'Te queda neto',
      comisionSpotNear: 'Comisión SpotNear',
      ocupacion: 'Ocupación ahora',
      proximosDias: (reservas, minimoLibres, capacidad, momento) =>
        reservas === 0
          ? 'Próximos 7 días: sin reservas.'
          : `Próximos 7 días: ${reservas} ${reservas === 1 ? 'reserva' : 'reservas'} · en el momento más cargado${momento ? ` (${new Date(momento).toLocaleString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })})` : ''} quedan ${minimoLibres} de ${capacidad} lugares libres.`,
      adentro: 'Vehículos adentro',
      proximasLlegadas: 'Próximas llegadas',
      sinLlegadas: 'No hay llegadas previstas en las próximas 12 horas.',
      reservasPorDia: 'Reservas por día',
      ultimosDias: (n) => `Últimos ${n} días`,
      esteMes: 'Este mes',
      verTodas: 'Ver todas',
      compartirDia: 'Compartir el día en WhatsApp',
      sinReservasHoy: 'Todavía no hay reservas para hoy.',
    },
    reservas: {
      titulo: 'Reservas',
      nueva: 'Cargar reserva',
      buscar: 'Buscar por nombre, patente, código o teléfono',
      buscarCorto: 'Código o patente',
      filtrarEstado: 'Estado',
      filtrarEvento: 'Evento',
      desde: 'Desde',
      hasta: 'Hasta',
      todos: 'Todos',
      // La vista por defecto: todo lo que tiene la seña pagada.
      todosConSena: 'Todas (con seña pagada)',
      sinSena: 'Esperando la seña (sin pagar)',
      pagoLoConfirmaMP: 'El pago de la seña lo confirma Mercado Pago, no se cambia a mano.',
      exportar: 'Exportar CSV',
      resumenDia: 'Resumen del día',
      sinResultados: 'No hay reservas con esos filtros',
      sinResultadosTexto: 'Probá cambiar las fechas o limpiar la búsqueda.',
      columnas: {
        codigo: 'Código',
        cliente: 'Cliente',
        telefono: 'Teléfono',
        vehiculo: 'Vehículo',
        patente: 'Patente',
        ingreso: 'Ingreso',
        salida: 'Salida',
        estado: 'Estado',
        monto: 'Monto',
        acciones: 'Acciones',
      },
      acciones: {
        checkIn: 'Check-in',
        checkOut: 'Check-out',
        cancelar: 'Cancelar',
        noShow: 'No se presentó',
        ver: 'Ver',
        whatsapp: 'WhatsApp',
      },
      confirmarCancelar: '¿Seguro que querés cancelar esta reserva?',
      motivoCancelacion: 'Motivo (opcional)',
      // Deja explícito que este número es el histórico completo. Sin esto, no
      // se entiende por qué no coincide con el de Comisiones, que filtra por
      // período y por estado.
      total: (n) => `${n} ${n === 1 ? 'reserva' : 'reservas'} en total (todo el historial)`,
      parkingEliminado: 'Eliminado',
      // Quitar del panel una reserva terminada (finalizada, cancelada o no se
      // presentó). Es un borrado lógico: ver README → "Eliminar reservas terminadas".
      eliminar: 'Eliminar reserva',
      eliminarCorto: 'Eliminar',
      eliminarTitulo: (codigo) => `¿Eliminar la reserva ${codigo}?`,
      eliminarAviso: 'Esta acción es irreversible: la reserva no vuelve al listado.',
      eliminarTexto:
        'Desaparece del listado de reservas y de la búsqueda. Lo ya facturado no se pierde: sigue contando en el reporte de Comisiones, y el cliente conserva el link de su comprobante.',
      eliminada: 'Reserva eliminada.',
      pagina: (a, b) => `Página ${a} de ${b}`,
      anterior: 'Anterior',
      siguiente: 'Siguiente',
      busquedaRapida: 'Búsqueda rápida',
      busquedaRapidaAyuda: 'Escribí el código o la patente que te muestra el cliente.',
    },
    detalleReserva: {
      corregirVehiculo: {
        label: 'Corregir el tipo de vehículo',
        boton: 'Corregir',
        ayuda:
          'Si en la entrada ves que no es el tipo cargado, corregilo: se recalcula lo que el cliente paga en el lugar. La seña no cambia.',
        listo: 'Tipo de vehículo corregido.',
        cobrarDeMas: (diferencia, total) =>
          `Cobrale ${diferencia} más en el lugar: con el tipo corregido le quedan ${total} por pagar.`,
        cobrarDeMenos: (diferencia, total) =>
          `Son ${diferencia} menos: con el tipo corregido le quedan ${total} por pagar en el lugar.`,
      },
      titulo: 'Reserva',
      volver: 'Volver a reservas',
      datosCliente: 'Cliente',
      datosVehiculo: 'Vehículo',
      periodo: 'Período',
      dinero: 'Dinero',
      precioTotal: 'Total de la reserva',
      comision: 'Comisión SpotNear',
      neto: 'Cobra el estacionamiento (en el lugar)',
      senaCobrada: 'Seña cobrada online',
      origen: 'Origen',
      creada: 'Creada',
      checkIn: 'Check-in',
      checkOut: 'Check-out',
      notificaciones: 'Envíos',
      sinNotificaciones: 'Todavía no se envió nada.',
      camposExtra: 'Datos adicionales',
      compartirGrupo: 'Compartir en el grupo',
      compartirCliente: 'Enviar al cliente',
      copiarMensaje: 'Copiar mensaje',
      mensajeCopiado: '¡Mensaje copiado!',
      verComprobante: 'Ver comprobante del cliente',
    },
    nuevaReserva: {
      titulo: 'Cargar una reserva',
      subtitulo: 'Para las que llegan por teléfono o por WhatsApp.',
      origen: 'Cómo llegó',
      origenes: {
        ADMIN: 'Cargada en el panel',
        WHATSAPP: 'Por WhatsApp',
        TELEFONO: 'Por teléfono',
      },
      guardar: 'Crear reserva',
      guardando: 'Creando...',
      creada: 'Reserva creada',
    },
    miEstacionamiento: {
      zonaPeligro: 'Zona de peligro',
      eliminar: 'Eliminar definitivamente',
      eliminarTexto:
        'Eliminar el estacionamiento de la plataforma. Desaparece del panel, del acceso de su dueño y de las búsquedas públicas.',
      eliminarNota:
        'Distinto de "Dar de baja", que solo lo despublica y se puede revertir. Esto no se puede deshacer.',
      eliminarAviso: 'Esta acción es irreversible. No hay forma de recuperarlo después.',
      eliminarQueSeVa: 'Se borran las tarifas, las fotos, los horarios y los cupos bloqueados.',
      eliminarQueQueda:
        'Las reservas se conservan para la contabilidad, con el nombre y la dirección guardados.',
      eliminarUsuarios: 'El dueño y el personal quedan desactivados y sin acceso al panel.',
      eliminarConfirmar: 'Escribí el nombre del estacionamiento para confirmar',
      titulo: 'Mi estacionamiento',
      datos: 'Datos generales',
      ubicacion: 'Ubicación',
      ubicacionAyuda: 'Buscá la dirección y ajustá el marcador si hace falta.',
      operacion: 'Operación',
      contacto: 'Contacto',
      whatsappGrupo: 'WhatsApp del grupo',
      whatsappGrupoAyuda:
        'Número al que se comparten las reservas. Puede ser el del encargado.',
      fotos: 'Fotos',
      agregarFoto: 'Agregar foto',
      urlFoto: 'URL de la foto',
      camposExtra: 'Campos opcionales del formulario',
      camposExtraAyuda:
        'Datos adicionales que le vas a pedir al cliente cuando reserve. Se agregan sin tocar la base.',
      agregarCampo: 'Agregar campo',
      bloqueos: 'Bloqueo de cupos',
      bloqueosAyuda: 'Reservá lugares para abonados, mantenimiento o uso propio.',
      agregarBloqueo: 'Bloquear cupos',
      guardar: 'Guardar cambios',
      guardando: 'Guardando...',
      guardado: 'Cambios guardados',
    },
    tarifas: {
      titulo: 'Tarifas',
      subtitulo: 'Lo que cobra el estacionamiento. Los precios son en pesos.',
      nueva: 'Nueva tarifa',
      tipo: 'Tipo',
      precio: 'Precio',
      descripcion: 'Descripción',
      vehiculo: 'Vehículo',
      todosLosVehiculos: 'Todos',
      vigencia: 'Vigencia',
      sinVigencia: 'Siempre',
      tipos: {
        HORA: 'Por hora',
        DIA: 'Por día',
        MENSUAL: 'Mensual',
      },
      comoSeCobra: 'Cómo se calcula el precio',
      explicacion:
        'Menos de 4 horas se cobra por hora. De 4 a 12 horas es media estadía: 4 veces el valor de la hora. De 12 a 24 horas es estadía completa: 5 veces el valor de la hora. Pasadas las 24 horas el ciclo se reinicia.',
      sinTarifas: 'Todavía no cargaste tarifas',
      sinTarifasTexto: 'Sin al menos una tarifa por hora, tu estacionamiento no aparece en las búsquedas.',
      eliminar: 'Desactivar',
      confirmarEliminar: '¿Desactivar esta tarifa?',
    },
    equipo: {
      eliminar: 'Eliminar',
      eliminarTitulo: '¿Eliminar a esta persona?',
      eliminarAviso:
        'Se borra su usuario y pierde el acceso al panel. No se puede deshacer.',
      eliminarHistorial:
        'Las reservas que haya cargado se conservan con su nombre guardado, y los registros de auditoría quedan igual.',
      titulo: 'Equipo',
      subtitulo: 'Los usuarios que pueden entrar al panel de tu estacionamiento.',
      nuevo: 'Agregar persona',
      nombre: 'Nombre',
      email: 'Email',
      password: 'Contraseña',
      passwordAyuda: 'Mínimo 8 caracteres. Se la pasás vos a la persona.',
      rol: 'Rol',
      estado: 'Estado',
      ultimoLogin: 'Último ingreso',
      nunca: 'Nunca ingresó',
      activo: 'Activo',
      inactivo: 'Inactivo',
      darDeBaja: 'Dar de baja',
      confirmarBaja: '¿Dar de baja a esta persona? Se le cierran todas las sesiones.',
      rolAyuda: {
        OWNER: 'Ve y administra todo el estacionamiento: tarifas, equipo y reservas.',
        STAFF: 'Ve las reservas y hace check-in y check-out. No toca configuración.',
      },
    },
    comisiones: {
      // El reporte cuenta solo las reservas del período elegido y descarta las
      // canceladas: por eso da menos que el total de la pantalla de Reservas.
      alcance: 'Solo las reservas del período elegido, sin contar las canceladas.',
      parkingEliminado: 'Ya no está en la plataforma',
      titulo: 'Comisiones',
      tituloOwner: 'Mi facturación',
      subtitulo: 'Lo que generó la plataforma por estacionamiento y por período.',
      subtituloOwner: 'Lo que facturaste a través de SpotNear.',
      desde: 'Desde',
      hasta: 'Hasta',
      agrupar: 'Agrupar por',
      porParking: 'Estacionamiento',
      porMes: 'Mes',
      estacionamiento: 'Estacionamiento',
      periodo: 'Período',
      reservas: 'Reservas',
      facturado: 'Facturado',
      comision: 'Comisión SpotNear',
      neto: 'Cobra el estacionamiento',
      totales: 'Totales',
      exportar: 'Exportar CSV',
      sinDatos: 'No hay reservas en ese período',
    },
    solicitudes: {
      titulo: 'Solicitudes de alta',
      subtitulo: 'Estacionamientos que se registraron por su cuenta y esperan tu aprobación.',
      pendientes: 'Pendientes',
      aprobadas: 'Aprobadas',
      rechazadas: 'Rechazadas',
      todas: 'Todas',
      duenio: 'Dueño',
      recibida: 'Recibida',
      capacidad: 'Capacidad',
      servicios: 'Servicios',
      aprobar: 'Aprobar y publicar',
      rechazar: 'Rechazar',
      motivoRechazo: 'Motivo del rechazo (opcional)',
      motivoAyuda: 'Se lo mandamos por email al dueño. Si lo dejás vacío, recibe solo el aviso.',
      confirmarAprobar:
        '¿Aprobar este estacionamiento? Queda publicado y el dueño va a poder entrar al panel.',
      sinSolicitudes: 'No hay solicitudes pendientes',
      sinSolicitudesTexto: 'Cuando alguien se registre desde la web, la solicitud aparece acá.',
      aprobada: 'Solicitud aprobada',
      rechazada: 'Solicitud rechazada',
      recordatorioTarifas:
        'Acordate de que, hasta que el dueño no cargue al menos una tarifa por hora, el estacionamiento no aparece en las búsquedas.',
    },
    estacionamientos: {
      titulo: 'Estacionamientos',
      subtitulo: 'Todos los estacionamientos de la plataforma.',
      nuevo: 'Nuevo estacionamiento',
      publicado: 'Publicado',
      noPublicado: 'Sin publicar',
      inactivo: 'Dado de baja',
      capacidad: 'Capacidad',
      comision: 'Comisión',
      reservas: 'Reservas',
      usuarios: 'Usuarios',
      publicar: 'Publicar',
      despublicar: 'Despublicar',
      darDeBaja: 'Dar de baja',
      datosDelDueno: 'Usuario dueño',
      datosDelDuenoAyuda: 'Se crea junto con el estacionamiento para que pueda entrar al panel.',
    },
  },

  estados: {
    // PENDIENTE = la seña todavía no se acreditó. Se dice así, sin rodeos, para
    // que nadie en el panel la confunda con un cliente que va a llegar.
    PENDIENTE: 'Esperando la seña',
    CONFIRMADA: 'Confirmada',
    EN_CURSO: 'En curso',
    FINALIZADA: 'Finalizada',
    CANCELADA: 'Cancelada',
    NO_SHOW: 'No se presentó',
  },

  origenes: {
    WEB: 'Web',
    ADMIN: 'Panel',
    WHATSAPP: 'WhatsApp',
    TELEFONO: 'Teléfono',
    API: 'API',
  },

  errores: {
    generico: 'Algo salió mal. Intentá de nuevo en unos minutos.',
    red: 'No pudimos conectarnos. Revisá tu conexión a internet.',
    servidorCaido:
      'No pudimos conectarnos con el servidor de SpotNear. Si estás en desarrollo, fijate que la API esté levantada.',
    noEncontrado: 'No encontramos lo que buscabas',
    sinPermiso: 'No tenés permiso para ver esta sección.',
    sesionExpirada: 'Tu sesión expiró. Ingresá de nuevo.',
    campoObligatorio: 'Este campo es obligatorio',
    emailInvalido: 'El email no tiene un formato válido',
    telefonoInvalido: 'Escribí el teléfono con código de área, por ejemplo 11 1234 5678',
    patenteInvalida: 'Usá ABC123 (viejo) o AB123CD (Mercosur)',
    passwordCorta: 'La contraseña tiene que tener al menos 8 caracteres',
    fechaInvalida: 'La fecha no es válida',
    finAntesQueInicio: 'La salida tiene que ser posterior al ingreso',
    reintentar: 'Reintentar',
  },

  comunes: {
    servidorDespertando: "Estamos despertando el servidor, puede tardar hasta un minuto la primera vez...",
    cargando: 'Cargando...',
    guardar: 'Guardar',
    guardando: 'Guardando...',
    cancelar: 'Cancelar',
    cerrar: 'Cerrar',
    eliminar: 'Eliminar',
    editar: 'Editar',
    agregar: 'Agregar',
    confirmar: 'Confirmar',
    volver: 'Volver',
    si: 'Sí',
    no: 'No',
    opcional: 'opcional',
    de: 'de',
    hoy: 'Hoy',
    manana: 'Mañana',
    ayer: 'Ayer',
    ver: 'Ver',
    copiar: 'Copiar',
    copiado: '¡Copiado!',
  },

  /* ── Registro público de estacionamientos ── */
  registro: {
    titulo: 'Sumá tu estacionamiento a SpotNear',
    subtitulo:
      'Recibí reservas por internet, sin anotar nada a mano. Cargás tus datos, lo revisamos y en menos de 24 horas estás publicado.',
    beneficios: [
      {
        titulo: 'Reservas que llegan solas',
        texto: 'El cliente reserva desde la web y vos recibís el aviso con todos los datos.',
      },
      {
        titulo: 'Tu propio panel',
        texto: 'Tarifas, cupos, check-in y check-out. Tu equipo entra desde el celular.',
      },
      {
        titulo: 'Cobrás como siempre',
        texto: 'El cliente te paga tu tarifa completa en el lugar, como siempre. Sin retenciones.',
      },
    ],
    pasos: ['Tus datos', 'El estacionamiento', 'Confirmación'],
    paso: (n, total) => `Paso ${n} de ${total}`,

    seccionDuenio: 'Tus datos',
    seccionDuenioAyuda: 'Con estos datos vas a entrar al panel una vez aprobada la solicitud.',
    nombre: 'Nombre',
    apellido: 'Apellido',
    email: 'Email',
    emailAyuda: 'Acá te avisamos cuando esté aprobada.',
    telefono: 'Teléfono',
    password: 'Contraseña',
    passwordAyuda: 'Mínimo 8 caracteres.',
    passwordRepetir: 'Repetir contraseña',
    passwordNoCoincide: 'Las contraseñas no coinciden.',

    seccionParking: 'Tu estacionamiento',
    nombreComercial: 'Nombre comercial',
    nombreComercialAyuda: 'Como lo conocen tus clientes. Es el que va a ver la gente al buscar.',
    direccion: 'Dirección',
    direccionAyuda: 'Buscala con el autocompletado y ajustá el marcador si hace falta.',
    ubicacionAyuda: 'Arrastrá el marcador hasta la entrada exacta.',
    descripcion: 'Descripción',
    descripcionAyuda: 'Opcional. Contá qué tiene de bueno: cercanía, seguridad, accesos.',
    capacidad: 'Capacidad total',
    capacidadAyuda: 'Cuántos vehículos entran en total.',
    tiposVehiculo: 'Tipos de vehículo que aceptás',
    cubierto: 'Es cubierto',
    horarios: 'Horarios de atención',
    horariosModos: [
      {
        id: 'FIJO',
        titulo: 'Horario fijo',
        texto: 'Abrís y cerrás a la misma hora todos los días.',
        icono: 'reloj',
      },
      {
        id: 'ABIERTO_24HS',
        titulo: 'Abierto las 24 horas',
        texto: 'Nunca cerrás.',
        icono: 'escudo',
      },
      {
        id: 'FIN_EVENTO',
        titulo: 'Cerramos cuando termina el evento',
        texto: 'Abrís a una hora fija y cerrás recién cuando se termina el show.',
        icono: 'evento',
      },
    ],
    horariosAyuda:
      'Elegí la última opción si tu estacionamiento cierra apenas termina el evento del día, sin importar la hora.',
    abre: 'Abre',
    cierra: 'Cierra',
    cierraConEvento: 'Cierra al finalizar el evento',
    cierraConEventoAyuda: 'No hace falta que cargues una hora: el cierre lo marca el evento.',
    servicios: 'Servicios',
    fotos: 'Fotos',
    fotosAyuda:
      'Mostrá la entrada, el interior y la cartelería. La primera es la que se ve en los resultados.',
    fotosNoConfiguradasTitulo: 'La subida de fotos todavía no está disponible',
    fotosNoConfiguradas:
      'Podés mandar la solicitud sin fotos, o pegar links de fotos publicadas en otro lado (abajo). Las agregamos antes de publicar tu estacionamiento.',
    fotosSoltar: 'Arrastrá tus fotos acá',
    fotosOSeleccionar: 'o elegilas desde tu dispositivo',
    fotosBoton: 'Elegir fotos',
    fotosLimites: (max, mb) => `Hasta ${max} fotos · ${mb} MB cada una · JPG, PNG, WebP, AVIF o HEIC`,
    fotosSubiendo: 'Subiendo...',
    fotosQuitar: 'Quitar foto',
    fotosPortada: 'Portada',
    fotosCuenta: (n, max) => `${n} de ${max} fotos`,
    fotosFaltan: 'Subí al menos una foto de tu estacionamiento para continuar.',
    fotosDemasiadas: (max) => `Podés subir hasta ${max} fotos.`,
    fotosPesada: (nombre, mb) => `"${nombre}" supera los ${mb} MB.`,
    fotosTipoInvalido: (nombre) => `"${nombre}" no es una imagen válida.`,
    fotosErrorSubida: 'No pudimos subir las fotos. Revisá tu conexión e intentá de nuevo.',
    fotosPorUrl: '¿Preferís pegar un link?',
    fotosPorUrlAyuda: 'Opcional. Una URL por línea, si ya tenés las fotos publicadas en otro lado.',

    seccionCondiciones: 'Condiciones',
    comisionTitulo: 'Vos cobrás el 100% de tu tarifa',
    comisionTexto:
      'Al reservar, el cliente nos paga una seña del 20% que no se le devuelve. Esa seña se queda en SpotNear como cargo por el uso de la plataforma. Tu tarifa la cobrás entera, en tu estacionamiento, directo del cliente: no te retenemos nada ni tenés que esperar transferencias nuestras.',
    comisionEjemplo: (tarifa, sena, total) =>
      `Ejemplo: si tu tarifa es ${tarifa}, el cliente paga ${sena} de seña al reservar y te paga los ${tarifa} a vos cuando llega. Su reserva le sale ${total}.`,
    aceptaComision:
      'Entiendo que SpotNear le cobra al cliente una seña no reembolsable del 20% por el uso de la plataforma, y que yo cobro el valor de mi tarifa directamente del cliente en mi estacionamiento',
    aceptaTerminos: 'Acepto los términos y condiciones y la política de privacidad',

    anterior: 'Volver',
    siguiente: 'Continuar',
    enviar: 'Enviar solicitud',
    enviando: 'Enviando...',

    exitoTitulo: '¡Recibimos tu solicitud!',
    exitoTexto:
      'La revisamos a mano y te respondemos en menos de 24 horas. Te escribimos a tu email apenas esté lista.',
    exitoQueSigue: 'Mientras tanto',
    exitoPasos: [
      'Te mandamos un mail confirmando que la recibimos.',
      'Revisamos los datos y la ubicación del estacionamiento.',
      'Cuando esté aprobada vas a poder entrar al panel con tu email y contraseña.',
    ],
    exitoVolver: 'Volver al inicio',
    yaTenesCuenta: '¿Ya tenés cuenta?',
    ingresarAlPanel: 'Entrá al panel',
  },

  footer: {
    producto: 'Producto',
    empresa: 'Empresa',
    legal: 'Legal',
    contacto: 'Contacto',
    terminos: 'Términos y condiciones',
    privacidad: 'Política de privacidad',
    sobreNosotros: 'Sobre nosotros',
    paraEstacionamientos: 'Para estacionamientos',
    registrarEstacionamiento: 'Registrá tu estacionamiento',
    derechos: (anio) => `© ${anio} SpotNear · Un producto de ColdevIA`,
    hechoEn: 'Hecho en Buenos Aires',
  },

  error404: {
    titulo: 'Esta página no existe',
    texto: 'El link puede estar mal escrito o la página puede haberse mudado.',
    volver: 'Volver al inicio',
    buscar: 'Buscar estacionamientos',
  },
};

export default textos;
