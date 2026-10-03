/**
 * Especificación OpenAPI 3.0 de la API de SpotNear.
 * Se sirve en /api/docs (Swagger UI) y en /api/openapi.json.
 *
 * Se escribe a mano y no se autogenera: el documento es el contrato con el
 * frontend y con la futura app móvil, así que conviene que sea explícito.
 */
import env from '../config/env.js';

const respuestaError = (descripcion) => ({
  description: descripcion,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
    },
  },
});

const parametroFecha = (nombre, descripcion, requerido = true) => ({
  name: nombre,
  in: 'query',
  required: requerido,
  schema: { type: 'string', format: 'date-time' },
  description: descripcion,
  example: '2026-09-25T22:00:00.000Z',
});

export const documentoOpenAPI = {
  openapi: '3.0.3',
  info: {
    title: 'SpotNear API',
    version: '1.0.0',
    description: [
      'API REST de **SpotNear**, el marketplace de reservas de estacionamientos de ColdevIA.',
      '',
      '## Cómo usarla',
      '1. Los endpoints **públicos** (buscar, cotizar, reservar, ver comprobante) no necesitan autenticación.',
      '2. Los endpoints de **panel** (`/admin/*`) requieren `Authorization: Bearer <accessToken>`.',
      '3. El access token dura 15 minutos; renovalo con `POST /auth/refresh` usando el refresh token.',
      '',
      '## Aislamiento entre estacionamientos',
      'Un usuario `OWNER` o `STAFF` solo puede leer y modificar datos de **su** estacionamiento.',
      'Esto se valida en el backend en cada endpoint. El `SUPERADMIN` ve toda la plataforma y',
      'puede acotar la consulta a un estacionamiento con `?parkingId=`.',
      '',
      '## Formato de errores',
      'Todos los errores responden con `{ "error": { "codigo": "...", "mensaje": "..." } }`,',
      'con el mensaje ya redactado en español para mostrarle al usuario.',
    ].join('\n'),
    contact: { name: 'ColdevIA', url: 'https://spotnear.com.ar' },
  },
  servers: [
    { url: `${env.PUBLIC_API_URL}/api/v1`, description: 'Servidor actual' },
    { url: 'http://localhost:4000/api/v1', description: 'Desarrollo local' },
  ],
  tags: [
    { name: 'Salud', description: 'Estado del servicio' },
    { name: 'Auth', description: 'Inicio de sesión y tokens' },
    { name: 'Estacionamientos (público)', description: 'Búsqueda y detalle' },
    { name: 'Reservas (público)', description: 'Reservar como invitado y ver el comprobante' },
    { name: 'Alta de estacionamientos', description: 'Registro por autogestión del dueño' },
    { name: 'Pagos', description: 'Cobro de la seña y avisos de la pasarela' },
    { name: 'Panel · Reservas', description: 'Gestión de reservas del estacionamiento' },
    { name: 'Panel · Estacionamientos', description: 'Datos, fotos, campos y cupos' },
    { name: 'Panel · Tarifas', description: 'Tarifas por hora, día y mes' },
    { name: 'Panel · Equipo', description: 'Usuarios OWNER y STAFF' },
    { name: 'Panel · Solicitudes', description: 'Aprobación de altas por autogestión (SUPERADMIN)' },
    { name: 'Panel · Reportes', description: 'Dashboard y comisiones' },
  ],

  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              codigo: { type: 'string', example: 'SIN_CUPO' },
              mensaje: { type: 'string', example: 'No quedan lugares disponibles en ese horario.' },
              detalle: { type: 'object', nullable: true },
            },
          },
        },
      },
      Usuario: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string', format: 'email' },
          nombre: { type: 'string' },
          role: { type: 'string', enum: ['SUPERADMIN', 'OWNER', 'STAFF'] },
          parkingId: { type: 'string', nullable: true },
        },
      },
      Sesion: {
        type: 'object',
        properties: {
          usuario: { $ref: '#/components/schemas/Usuario' },
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
        },
      },
      ParkingPublico: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          slug: { type: 'string', example: 'humboldt-450' },
          nombre: { type: 'string', example: 'Estacionamiento Humboldt 450' },
          direccion: { type: 'string' },
          barrio: { type: 'string', nullable: true },
          lat: { type: 'number', format: 'double' },
          lng: { type: 'number', format: 'double' },
          cubierto: { type: 'boolean' },
          capacidadTotal: { type: 'integer' },
          tiposVehiculo: { type: 'array', items: { type: 'string' } },
          servicios: { type: 'array', items: { type: 'string' } },
          calificacion: { type: 'number', nullable: true },
          cantidadResenas: { type: 'integer' },
          foto: { type: 'string', nullable: true },
          precioDesde: { type: 'number', nullable: true },
          distanciaMetros: { type: 'integer' },
          minutosCaminando: { type: 'integer' },
          etiquetas: {
            type: 'array',
            items: { type: 'string', enum: ['MAS_CERCA', 'MAS_BARATO', 'MEJOR_CALIFICADO'] },
          },
          precio: {
            type: 'object',
            properties: {
              total: { type: 'number', example: 12000 },
              moneda: { type: 'string', example: 'ARS' },
              desglose: { $ref: '#/components/schemas/DesglosePrecio' },
            },
          },
          disponibilidad: {
            type: 'object',
            properties: {
              libres: { type: 'integer' },
              hayLugar: { type: 'boolean' },
              capacidadTotal: { type: 'integer' },
            },
          },
        },
      },
      DesglosePrecio: {
        type: 'object',
        properties: {
          modo: { type: 'string', enum: ['HORA', 'DIA', 'MENSUAL'] },
          etiqueta: { type: 'string', example: '5 horas' },
          precioUnitario: { type: 'number' },
          unidades: { type: 'integer' },
          subtotal: { type: 'number' },
          cantidadVehiculos: { type: 'integer' },
        },
      },
      DatosCliente: {
        type: 'object',
        required: ['nombre', 'apellido', 'telefono'],
        properties: {
          nombre: { type: 'string', example: 'Juan' },
          apellido: { type: 'string', example: 'Pérez' },
          telefono: {
            type: 'string',
            description: 'Se acepta cualquier formato argentino y se normaliza a E.164.',
            example: '+54 9 11 1234 5678',
          },
          email: { type: 'string', format: 'email', nullable: true },
        },
      },
      DatosVehiculo: {
        type: 'object',
        required: ['patente'],
        properties: {
          patente: {
            type: 'string',
            description: 'Formato viejo (ABC123) o Mercosur (AB123CD). Se guarda en mayúsculas.',
            example: 'AB123CD',
          },
          tipo: { type: 'string', enum: ['AUTO', 'CAMIONETA', 'MOTO', 'UTILITARIO'], default: 'AUTO' },
          marca: { type: 'string', nullable: true, example: 'Toyota' },
          modelo: { type: 'string', nullable: true, example: 'Corolla' },
          color: { type: 'string', nullable: true, example: 'Gris' },
        },
      },
      NuevaReserva: {
        type: 'object',
        required: ['parkingId', 'inicio', 'fin', 'cliente', 'vehiculo'],
        properties: {
          parkingId: { type: 'string' },
          inicio: { type: 'string', format: 'date-time' },
          fin: { type: 'string', format: 'date-time' },
          cliente: { $ref: '#/components/schemas/DatosCliente' },
          vehiculo: { $ref: '#/components/schemas/DatosVehiculo' },
          cantidadVehiculos: { type: 'integer', default: 1, minimum: 1 },
          notas: { type: 'string', nullable: true },
          camposExtra: {
            type: 'object',
            description: 'Respuestas a los campos opcionales que configuró el estacionamiento.',
            additionalProperties: true,
          },
        },
      },
      Comprobante: {
        type: 'object',
        properties: {
          reserva: {
            type: 'object',
            properties: {
              codigo: { type: 'string', example: 'SN-7K3P9Q' },
              publicToken: { type: 'string' },
              estado: {
                type: 'string',
                enum: ['PENDIENTE', 'CONFIRMADA', 'EN_CURSO', 'FINALIZADA', 'CANCELADA', 'NO_SHOW'],
              },
              inicio: { type: 'string', format: 'date-time' },
              fin: { type: 'string', format: 'date-time' },
              precioTotal: { type: 'number' },
              paymentStatus: { type: 'string', enum: ['PENDIENTE', 'PAGADO', 'FALLIDO', 'REEMBOLSADO'] },
            },
          },
          qr: { type: 'string', nullable: true, description: 'PNG en data URL.' },
          links: {
            type: 'object',
            properties: {
              comprobante: { type: 'string' },
              comoLlegar: { type: 'string' },
              whatsappCliente: { type: 'string' },
              whatsappCompartir: { type: 'string' },
            },
          },
          mensajeWhatsApp: { type: 'string' },
        },
      },
      ReservaAdmin: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          codigo: { type: 'string' },
          estado: { type: 'string' },
          inicio: { type: 'string', format: 'date-time' },
          fin: { type: 'string', format: 'date-time' },
          precioTotal: { type: 'number' },
          comisionPorcentaje: { type: 'number' },
          montoComision: { type: 'number' },
          montoNeto: { type: 'number' },
          cliente: { type: 'object' },
          vehiculo: { type: 'object' },
        },
      },
    },
  },

  paths: {
    '/health': {
      get: {
        tags: ['Salud'],
        summary: 'Estado del servicio y de la base',
        responses: { 200: { description: 'Servicio operativo' } },
      },
    },
    '/config': {
      get: {
        tags: ['Salud'],
        summary: 'Configuración pública del servidor',
        description: 'Moneda, zona horaria y si el pago online o el email están activos.',
        responses: { 200: { description: 'Configuración' } },
      },
    },

    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Iniciar sesión',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'admin@spotnear.com.ar' },
                  password: { type: 'string', format: 'password' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Sesión iniciada',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Sesion' } } },
          },
          401: respuestaError('Credenciales incorrectas'),
          429: respuestaError('Demasiados intentos'),
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Renovar el access token',
        description: 'El refresh token se rota: el anterior queda revocado.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: { refreshToken: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Tokens renovados' },
          401: respuestaError('Refresh token inválido o vencido'),
        },
      },
    },
    '/auth/logout': {
      post: { tags: ['Auth'], summary: 'Cerrar sesión', responses: { 200: { description: 'Sesión cerrada' } } },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Usuario autenticado',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Datos del usuario' }, 401: respuestaError('No autenticado') },
      },
    },

    '/parkings': {
      get: {
        tags: ['Estacionamientos (público)'],
        summary: 'Buscar estacionamientos',
        description:
          'Devuelve los estacionamientos cercanos con el precio calculado para el rango pedido y la disponibilidad real.',
        parameters: [
          { name: 'lat', in: 'query', required: true, schema: { type: 'number' }, example: -34.5989 },
          { name: 'lng', in: 'query', required: true, schema: { type: 'number' }, example: -58.4455 },
          { name: 'radio', in: 'query', schema: { type: 'integer', default: 2500 }, description: 'Metros' },
          parametroFecha('inicio', 'Hora de ingreso'),
          parametroFecha('fin', 'Hora de salida'),
          { name: 'modalidad', in: 'query', schema: { type: 'string', enum: ['HORARIO', 'MENSUAL'] } },
          { name: 'tipoVehiculo', in: 'query', schema: { type: 'string', enum: ['AUTO', 'CAMIONETA', 'MOTO', 'UTILITARIO'] } },
          { name: 'cubierto', in: 'query', schema: { type: 'boolean' } },
          { name: 'precioMax', in: 'query', schema: { type: 'number' } },
          { name: 'calificacionMin', in: 'query', schema: { type: 'number' } },
          { name: 'servicios', in: 'query', schema: { type: 'string' }, description: 'Separados por coma: camaras,24hs' },
          { name: 'orden', in: 'query', schema: { type: 'string', enum: ['RELEVANCIA', 'PRECIO', 'DISTANCIA', 'CALIFICACION'] } },
        ],
        responses: {
          200: {
            description: 'Resultados',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    resultados: { type: 'array', items: { $ref: '#/components/schemas/ParkingPublico' } },
                    total: { type: 'integer' },
                  },
                },
              },
            },
          },
          422: respuestaError('Parámetros inválidos'),
        },
      },
    },
    '/parkings/{idOSlug}': {
      get: {
        tags: ['Estacionamientos (público)'],
        summary: 'Detalle de un estacionamiento',
        parameters: [
          { name: 'idOSlug', in: 'path', required: true, schema: { type: 'string' }, example: 'humboldt-450' },
          parametroFecha('inicio', 'Hora de ingreso', false),
          parametroFecha('fin', 'Hora de salida', false),
        ],
        responses: { 200: { description: 'Detalle' }, 404: respuestaError('No existe') },
      },
    },
    '/parkings/{id}/cotizar': {
      post: {
        tags: ['Estacionamientos (público)'],
        summary: 'Cotizar una estadía',
        description: 'Calcula el precio y verifica disponibilidad sin crear la reserva.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['inicio', 'fin'],
                properties: {
                  inicio: { type: 'string', format: 'date-time' },
                  fin: { type: 'string', format: 'date-time' },
                  tipoVehiculo: { type: 'string', nullable: true },
                  cantidadVehiculos: { type: 'integer', default: 1 },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Cotización' }, 422: respuestaError('Sin tarifa aplicable') },
      },
    },

    '/reservations': {
      post: {
        tags: ['Reservas (público)'],
        summary: 'Crear una reserva (como invitado)',
        description:
          'No requiere cuenta. Valida patente y teléfono argentinos, controla el cupo dentro de una transacción serializable y devuelve el comprobante con QR y links de WhatsApp.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/NuevaReserva' } } },
        },
        responses: {
          201: {
            description: 'Reserva creada',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Comprobante' } } },
          },
          409: respuestaError('No hay lugares disponibles en ese horario'),
          422: respuestaError('Datos inválidos (patente, teléfono, horario)'),
          429: respuestaError('Demasiadas reservas desde la misma IP'),
        },
      },
    },
    '/reservations/comprobante/{token}': {
      get: {
        tags: ['Reservas (público)'],
        summary: 'Ver un comprobante',
        description: 'Link público protegido por un token no adivinable de 32 bytes.',
        parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Comprobante', content: { 'application/json': { schema: { $ref: '#/components/schemas/Comprobante' } } } },
          404: respuestaError('No existe'),
        },
      },
    },
    '/reservations/comprobante/{token}/qr.svg': {
      get: {
        tags: ['Reservas (público)'],
        summary: 'QR del comprobante en SVG',
        parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'SVG', content: { 'image/svg+xml': {} } },
          409: respuestaError('La seña todavía no se acreditó: no hay comprobante'),
        },
      },
    },

    '/reservations/comprobante/{token}/pago': {
      get: {
        tags: ['Reservas (público)'],
        summary: 'Estado del cobro de la seña',
        description:
          'No es una consulta pasiva: le pregunta a la pasarela y, si el pago está aprobado, ' +
          'confirma la reserva y dispara el comprobante y el aviso al estacionamiento. ' +
          'Es la que usa la pantalla de pago mientras espera, y la que hace que el flujo no ' +
          'dependa únicamente del webhook.',
        parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Estado del pago',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    codigo: { type: 'string', example: 'SN-7K3P9Q' },
                    estado: { type: 'string', enum: ['PENDIENTE', 'PAGADO', 'FALLIDO', 'REEMBOLSADO'] },
                    detalle: { type: 'string', nullable: true, example: 'approved/accredited' },
                    url: { type: 'string', nullable: true, description: 'Checkout de la pasarela' },
                    esperandoLaSena: { type: 'boolean' },
                    sena: { type: 'number' },
                    aPagarEnElLugar: { type: 'number' },
                  },
                },
              },
            },
          },
          404: respuestaError('No existe'),
        },
      },
    },

    '/reservations/comprobante/{token}/pagar-sena': {
      post: {
        tags: ['Reservas (público)'],
        summary: 'Armar el checkout de la seña (botón "Pagar la seña")',
        parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Link nuevo al checkout' },
          409: respuestaError('La seña ya está acreditada'),
        },
      },
    },

    '/payments/mercadopago/webhook': {
      post: {
        tags: ['Pagos'],
        summary: 'Aviso de Mercado Pago sobre un pago',
        description:
          'Lo llama Mercado Pago, no un usuario. El aviso trae solo el id del pago: el estado se vuelve a leer contra la API con nuestro access token, así que un aviso falso no puede confirmar nada. Siempre responde 200, incluso ante un error nuestro, para que no se reintente durante horas.',
        responses: { 200: { description: 'Recibido' } },
      },
    },

    '/payments/estado': {
      get: {
        tags: ['Pagos'],
        summary: 'Diagnóstico de la pasarela',
        description: 'Si hay credenciales cargadas y si son de prueba o de producción. No expone secretos.',
        responses: { 200: { description: 'Configuración de la pasarela' } },
      },
    },
    '/reservations/comprobante/{token}/enviar-email': {
      post: {
        tags: ['Reservas (público)'],
        summary: 'Reenviar el comprobante por email',
        parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object', properties: { email: { type: 'string', format: 'email' } } },
            },
          },
        },
        responses: { 200: { description: 'Resultado del envío' } },
      },
    },

    '/reservations/comprobante/{token}/enviar-whatsapp': {
      post: {
        tags: ['Reservas (público)'],
        summary: 'Mandar la imagen del comprobante al WhatsApp del cliente',
        description:
          'Envía el PNG del comprobante por la API de WhatsApp configurada (Twilio o Cloud API) al teléfono de la reserva. Sin proveedor configurado responde `estado: NO_CONFIGURADO`.',
        parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: '{ ok, estado, mensaje }' },
          409: { description: 'La seña todavía no se pagó (SENA_PENDIENTE)' },
        },
      },
    },

    '/payments/mercadopago/vuelta/{token}': {
      get: {
        tags: ['Pagos'],
        summary: 'Vuelta desde el checkout de Mercado Pago (back_url)',
        description:
          'Sincroniza el pago contra la API de Mercado Pago y redirige (303) a /pago/:token de la web con `?vuelta=aprobado|pendiente|rechazado|sin-dato`. El estado de la URL no decide nada.',
        parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 303: { description: 'Redirección a la pantalla de pago de SpotNear' } },
      },
    },

    '/onboarding/parkings': {
      post: {
        tags: ['Alta de estacionamientos'],
        summary: 'Solicitud pública de alta',
        description:
          'Crea el estacionamiento y su usuario OWNER en estado PENDIENTE_APROBACION: no se publica, no aparece en la búsqueda y el dueño no puede entrar al panel hasta que un SUPERADMIN lo apruebe. No requiere autenticación y admite 5 solicitudes por hora por IP.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['duenio', 'parking', 'aceptaTerminos', 'aceptaComision'],
                properties: {
                  duenio: {
                    type: 'object',
                    required: ['nombre', 'apellido', 'email', 'telefono', 'password'],
                    properties: {
                      nombre: { type: 'string' },
                      apellido: { type: 'string' },
                      email: { type: 'string', format: 'email' },
                      telefono: { type: 'string', example: '11 1234 5678' },
                      password: { type: 'string', minLength: 8 },
                    },
                  },
                  parking: {
                    type: 'object',
                    required: ['nombre', 'direccion', 'lat', 'lng', 'capacidadTotal'],
                    properties: {
                      nombre: { type: 'string' },
                      descripcion: { type: 'string' },
                      direccion: { type: 'string' },
                      barrio: { type: 'string' },
                      lat: { type: 'number' },
                      lng: { type: 'number' },
                      capacidadTotal: { type: 'integer', minimum: 1 },
                      cubierto: { type: 'boolean' },
                      tiposVehiculo: { type: 'array', items: { type: 'string' } },
                      servicios: { type: 'array', items: { type: 'string' } },
                      horarios: { type: 'object' },
                      fotos: { type: 'array', items: { type: 'string', format: 'uri' } },
                    },
                  },
                  aceptaTerminos: { type: 'boolean', enum: [true] },
                  aceptaComision: { type: 'boolean', enum: [true] },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Solicitud registrada, a la espera de aprobación' },
          422: { description: 'Datos inválidos o email ya registrado' },
          429: { description: 'Demasiadas solicitudes desde esa IP' },
        },
      },
    },



    '/admin/onboarding': {
      get: {
        tags: ['Panel · Solicitudes'],
        summary: 'Bandeja de solicitudes de alta',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'estado',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['PENDIENTE_APROBACION', 'ACTIVO', 'RECHAZADO', 'TODAS'],
              default: 'PENDIENTE_APROBACION',
            },
          },
        ],
        responses: {
          200: { description: 'Solicitudes y cantidad de pendientes' },
          403: { description: 'Solo SUPERADMIN' },
        },
      },
    },

    '/admin/onboarding/{id}/aprobar': {
      post: {
        tags: ['Panel · Solicitudes'],
        summary: 'Aprobar una solicitud',
        description:
          'Pasa el estacionamiento a ACTIVO, lo publica y habilita al usuario OWNER. Le avisa al dueño por email.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Aprobada' }, 409: { description: 'Ya estaba aprobada' } },
      },
    },

    '/admin/onboarding/{id}/rechazar': {
      post: {
        tags: ['Panel · Solicitudes'],
        summary: 'Rechazar una solicitud',
        description: 'No borra nada: marca el registro como RECHAZADO con su motivo y avisa al dueño.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Rechazada' } },
      },
    },

    '/admin/reservations': {
      get: {
        tags: ['Panel · Reservas'],
        summary: 'Listado con búsqueda, filtros y paginación',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Nombre, patente, código o teléfono' },
          { name: 'estado', in: 'query', schema: { type: 'string' } },
          { name: 'desde', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'hasta', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'pagina', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'porPagina', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'Reservas del estacionamiento' }, 401: respuestaError('No autenticado') },
      },
      post: {
        tags: ['Panel · Reservas'],
        summary: 'Alta manual de una reserva',
        description: 'Para las que llegan por teléfono o WhatsApp. Mismo formulario que el público.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/NuevaReserva' } } },
        },
        responses: { 201: { description: 'Reserva creada' }, 409: respuestaError('Sin cupo') },
      },
    },
    '/admin/reservations/buscar': {
      get: {
        tags: ['Panel · Reservas'],
        summary: 'Búsqueda rápida por código o patente',
        description: 'Pensada para el playero en la entrada, desde el celular.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 3 } }],
        responses: { 200: { description: 'Coincidencias' } },
      },
    },
    '/admin/reservations/exportar.csv': {
      get: {
        tags: ['Panel · Reservas'],
        summary: 'Exportar reservas a CSV',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Archivo CSV', content: { 'text/csv': {} } } },
      },
    },
    '/admin/reservations/resumen-dia': {
      get: {
        tags: ['Panel · Reservas'],
        summary: 'Resumen del día para el grupo de WhatsApp',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'fecha', in: 'query', schema: { type: 'string', format: 'date' } }],
        responses: { 200: { description: 'Mensaje y link wa.me' } },
      },
    },
    '/admin/reservations/{id}/{accion}': {
      post: {
        tags: ['Panel · Reservas'],
        summary: 'Check-in, check-out, confirmar, cancelar o no-show',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          {
            name: 'accion',
            in: 'path',
            required: true,
            schema: { type: 'string', enum: ['check-in', 'check-out', 'confirmar', 'cancelar', 'no-show'] },
          },
        ],
        responses: {
          200: { description: 'Reserva actualizada' },
          409: respuestaError('Transición de estado no permitida'),
        },
      },
    },
    '/admin/reservations/{id}/whatsapp': {
      get: {
        tags: ['Panel · Reservas'],
        summary: 'Mensaje y link para compartir la reserva',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'destino', in: 'query', schema: { type: 'string', enum: ['grupo', 'cliente'] } },
        ],
        responses: { 200: { description: 'Mensaje formateado + link wa.me' } },
      },
    },

    '/admin/parkings': {
      get: {
        tags: ['Panel · Estacionamientos'],
        summary: 'Listar estacionamientos accesibles',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Lista' } },
      },
      post: {
        tags: ['Panel · Estacionamientos'],
        summary: 'Alta de estacionamiento (+ su usuario OWNER)',
        description: 'Solo SUPERADMIN.',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Creado' }, 403: respuestaError('Sin permiso') },
      },
    },
    '/admin/parkings/{id}': {
      patch: {
        tags: ['Panel · Estacionamientos'],
        summary: 'Editar estacionamiento',
        description:
          'El OWNER edita los datos operativos de su estacionamiento. La comisión y la publicación son exclusivas del SUPERADMIN.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Actualizado' }, 403: respuestaError('Fuera de tu estacionamiento') },
      },
    },
    '/admin/parkings/{id}/bloqueos': {
      post: {
        tags: ['Panel · Estacionamientos'],
        summary: 'Bloquear cupos en un rango',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 201: { description: 'Bloqueo creado' } },
      },
    },

    '/admin/rates': {
      get: {
        tags: ['Panel · Tarifas'],
        summary: 'Listar tarifas',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Tarifas' } },
      },
      post: {
        tags: ['Panel · Tarifas'],
        summary: 'Crear tarifa (HORA, DIA o MENSUAL)',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Tarifa creada' } },
      },
    },


    '/admin/staff': {
      get: { tags: ['Panel · Equipo'], summary: 'Listar usuarios del estacionamiento', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Usuarios' } } },
      post: {
        tags: ['Panel · Equipo'],
        summary: 'Crear usuario',
        description: 'Un OWNER solo puede crear usuarios STAFF de su propio estacionamiento.',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Creado' }, 403: respuestaError('Rol no permitido') },
      },
    },

    '/admin/reports/dashboard': {
      get: {
        tags: ['Panel · Reportes'],
        summary: 'Datos del dashboard',
        description: 'Reservas de hoy, ingresos previstos, ocupación, próximas llegadas y serie diaria.',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Dashboard' } },
      },
    },
    '/admin/reports/comisiones': {
      get: {
        tags: ['Panel · Reportes'],
        summary: 'Reporte de comisiones',
        description:
          'El SUPERADMIN ve la comisión de la plataforma; el OWNER ve su facturación y su neto.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'desde', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'hasta', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'agrupar', in: 'query', schema: { type: 'string', enum: ['PARKING', 'MES'] } },
        ],
        responses: { 200: { description: 'Reporte' } },
      },
    },
  },
};

export default documentoOpenAPI;
