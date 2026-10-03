# SpotNear · Backend

API REST de SpotNear. Node.js + Express + Prisma + PostgreSQL.

> La guía completa de instalación está en el [README de la raíz](../README.md).
> Acá va solo lo específico del backend.

---

## Arrancar

```bash
cp .env.example .env     # completá DATABASE_URL y los secretos JWT
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

| | |
|---|---|
| API | http://localhost:4000/api/v1 |
| Documentación | http://localhost:4000/api/docs |
| Estado | http://localhost:4000/api/v1/health |

---

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor con recarga automática (`node --watch`) |
| `npm start` | Servidor en modo producción |
| `npm run db:migrate` | Crea y aplica una migración (desarrollo) |
| `npm run db:deploy` | Aplica las migraciones existentes (producción) |
| `npm run db:seed` | Carga los datos de ejemplo |
| `npm run db:reset` | Borra y recrea la base |
| `npm run db:studio` | Prisma Studio |
| `npm run db:limpiar-pruebas` | Limpia datos de una corrida de tests interrumpida |
| `npm test` | Todos los tests |
| `npm run test:unit` | Solo los que no tocan la base |
| `npm run test:integration` | Solo los que van contra la base real |

---

## Cómo está organizado

```
src/
├── config/
│   ├── env.js          Variables de entorno validadas con Zod.
│   │                   Si falta algo crítico, el proceso no arranca.
│   └── prisma.js       Cliente único + reintento de errores de conexión
│                       transitorios (Postgres serverless suspende la base).
│
├── middleware/
│   ├── auth.js         JWT + AISLAMIENTO MULTI-TENANT. Acá está la pieza
│   │                   de seguridad más importante del sistema.
│   ├── validate.js     Validación de body/query/params con Zod.
│   ├── error.js        Manejo centralizado. Todos los errores salen igual.
│   └── rateLimit.js    Límites, más estrictos en login y reservas públicas.
│
├── modules/            Una carpeta por dominio. Cada una expone su router.
│   ├── auth/           Login, refresh con rotación, cambio de contraseña
│   ├── parkings/       Búsqueda pública + ABM del panel
│   ├── reservations/   El corazón: creación, estados, búsqueda, CSV
│   ├── rates/ events/ staff/ reports/
│   └── shared/         Piezas de validación reutilizables
│
├── services/           Lógica de negocio, sin Express de por medio
│   ├── pricing.js      Cálculo de precio y comisión
│   ├── availability.js Control de capacidad
│   ├── notifications/  WhatsApp y email, con adaptadores intercambiables
│   ├── payments/       Capa abstracta (Mercado Pago queda para la v2)
│   ├── qr.js           QR del comprobante
│   └── audit.js        Registro de acciones sensibles
│
└── utils/              patente · phone · money · dates · csv · geo · codes
```

**La regla:** los `modules/` hablan HTTP (validan la entrada, arman la respuesta)
y los `services/` no saben que existe Express. Por eso la lógica de precios y de
capacidad se puede testear sin levantar un servidor.

---

## Dos cosas que conviene entender antes de tocar código

### 1. El aislamiento entre estacionamientos

Un `OWNER` o `STAFF` **nunca** debe ver datos de otro estacionamiento. Esto se
hace con dos funciones de `middleware/auth.js`:

```js
// En un listado: acota el `where` al estacionamiento del usuario
const where = { ...filtroTenant(req), estado: 'CONFIRMADA' };

// En una operación sobre un id concreto: rechaza si no le corresponde
asegurarTenant(req, parkingId);
```

Si agregás un endpoint nuevo bajo `/admin`, **tiene que usar una de las dos**.
Los tests de `tests/integration/tenant.test.js` verifican que no se filtre nada.

### 2. El control de capacidad

La creación de reservas corre dentro de una transacción **Serializable**, porque
el recurso que se reparte es finito. Sin eso, dos personas que reservan el último
lugar en el mismo segundo entrarían las dos.

```js
await prisma.$transaction(crear, { isolationLevel: 'Serializable', timeout: 15_000 });
```

Bajo concurrencia, Postgres aborta una de las transacciones en conflicto
(código `P2034`); `crearReserva` reintenta hasta 3 veces. Hay un test que dispara
5 pedidos simultáneos por el último lugar y verifica que entre exactamente uno.

---

## Variables de entorno

Están todas documentadas en [`.env.example`](.env.example). Las imprescindibles:

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL |
| `JWT_SECRET` · `JWT_REFRESH_SECRET` | Firma de los tokens |
| `CORS_ORIGINS` | Orígenes permitidos, separados por coma |
| `PUBLIC_WEB_URL` | Base de los links del comprobante |

Opcionales: `SMTP_*` (si faltan, el email queda simulado), `WHATSAPP_*` (para la
Cloud API en la v2), `COMISION_DEFAULT_PORCENTAJE`.

---

## Agregar un campo al formulario de reserva

No hace falta migrar la base. Cada estacionamiento define sus campos extra desde
el panel (**Mi estacionamiento → Campos opcionales**); se guardan en
`CustomFieldConfig` y las respuestas van al JSON `Reservation.camposExtra`.

El checkout los renderiza solo, y `validarCamposExtra` en
`modules/reservations/reservations.service.js` se encarga de validarlos.
