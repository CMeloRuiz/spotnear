# SpotNear

**Marketplace de reservas de estacionamientos para Buenos Aires.**
Un producto de [ColdevIA](https://coldevia.com).

El cliente reserva su lugar por un link —sin crear cuenta— y cada estacionamiento
tiene su propio panel para ver y gestionar sus reservas. Reemplaza el ida y vuelta
por WhatsApp sin obligar a nadie a dejar WhatsApp.

---

## Índice

1. [Qué hace](#qué-hace)
2. [Stack](#stack)
3. [Puesta en marcha](#puesta-en-marcha)
4. [Desplegar en Render](#desplegar-en-render)
5. [Google Maps: cómo obtener y restringir la API key](#google-maps-cómo-obtener-y-restringir-la-api-key)
6. [Usuarios de prueba](#usuarios-de-prueba)
7. [Estructura del proyecto](#estructura-del-proyecto)
8. [Cómo se da de alta un estacionamiento](#cómo-se-da-de-alta-un-estacionamiento)
9. [Horarios: los tres modos de cierre](#horarios-los-tres-modos-de-cierre)
10. [Fotos de los estacionamientos](#fotos-de-los-estacionamientos)
11. [Cómo se calcula el precio](#cómo-se-calcula-el-precio)
12. [Cobro: la seña no reembolsable](#cobro-la-seña-no-reembolsable)
    · [Pasarela de pago: Mercado Pago (Checkout Pro)](#pasarela-de-pago-mercado-pago-checkout-pro)
13. [Eliminar cosas: qué se borra y qué se conserva](#eliminar-cosas-qué-se-borra-y-qué-se-conserva)
14. [Emails: cómo hacer que salgan de verdad](#emails-cómo-hacer-que-salgan-de-verdad)
15. [WhatsApp automático al grupo](#whatsapp-automático-al-grupo-del-estacionamiento)
16. [Seguridad y aislamiento entre estacionamientos](#seguridad-y-aislamiento-entre-estacionamientos)
17. [API](#api)
18. [Tests](#tests)
19. [Decisiones que tomé](#decisiones-que-tomé)
20. [Qué quedó pendiente o simulado](#qué-quedó-pendiente-o-simulado)

---

## Qué hace

### Para quien busca estacionar

- Busca **por dirección** (autocompletado con Google Places), por hora o por mes.
- Ve los estacionamientos cercanos en **lista y mapa**, con distancia caminando,
  calificación, servicios y **precio final de la estadía**.
- Reserva **como invitado**: nombre, teléfono, patente y tipo de vehículo. Sin
  cuenta, sin tarjeta.
- Recibe un **comprobante** con código legible (`SN-7K3P9Q`) y QR, que puede
  mandarse por WhatsApp, por email, descargar en PDF o guardar como imagen.
- Paga en el estacionamiento al llegar.

### Para el estacionamiento

- **Se registra solo** desde `/registrar-estacionamiento`, sin que nadie de
  ColdevIA tenga que cargarlo a mano. Queda pendiente de aprobación.
- **Panel propio**, con acceso solo a sus reservas.
- **Búsqueda rápida por código o patente** (atajo `/`), pensada para el playero
  en la entrada con el celular.
- **Check-in y check-out** en un toque.
- **Alta manual** de las reservas que siguen llegando por teléfono o WhatsApp.
- **Mensaje listo para el grupo de WhatsApp**, por reserva o como resumen del día.
- Tarifas por hora, por día y mensuales, con **escalones de media estadía y
  estadía completa** y precios distintos por tipo de vehículo.
- **Tres modos de horario**: fijo, 24 horas o cierre atado al evento del día.
- **Control de capacidad**: el sistema no deja sobrevender.
- Exportación a CSV y reporte de facturación.

### Para ColdevIA (SUPERADMIN)

- **Bandeja de solicitudes**: aprueba o rechaza los estacionamientos que se
  registraron por su cuenta.
- Alta y baja de estacionamientos, con su usuario dueño.
- Comisión configurable por estacionamiento (20% por defecto).
- Vista global de reservas y reporte de comisiones por estacionamiento o por mes.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + **CSS puro** (sin frameworks de estilos) |
| Backend | Node.js + Express (ESM) |
| Base de datos | PostgreSQL + Prisma (migraciones y seed incluidos) |
| Autenticación | JWT (access + refresh con rotación), contraseñas con bcrypt |
| Mapas | Google Maps JavaScript API + Places API (New) vía `@vis.gl/react-google-maps` |
| Imágenes | `sharp` (comprobante SVG → PNG) + `qrcode` |
| Tests | `node:test` + supertest |

---

## Puesta en marcha

### Requisitos

- **Node.js 20 o superior**
- Una base **PostgreSQL** (local, Neon, Supabase, Railway…)

### 1. Instalar

```bash
npm run install:all
```

Instala las dependencias de la raíz, del backend y del frontend.

### 2. Configurar las variables de entorno

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Lo mínimo que hay que completar:

**`backend/.env`**

```ini
DATABASE_URL="postgresql://usuario:clave@host:5432/spotnear?schema=public"
JWT_SECRET="..."
JWT_REFRESH_SECRET="..."
```

Para generar los secretos:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Con eso alcanza para que todo funcione: el cobro de la seña arranca en modo
simulado. Para cobrar de verdad hay que agregar dos líneas más, ver
[Pasarela de pago](#pasarela-de-pago-mercado-pago-checkout-pro).

**`frontend/.env`**

```ini
VITE_API_URL=http://localhost:4000/api/v1
VITE_GOOGLE_MAPS_API_KEY=tu-api-key
```

> La app **funciona sin API key de Google**: el mapa cae a una vista alternativa
> propia y el buscador usa una lista de lugares y barrios de Buenos Aires. Con la
> key, usa Google Maps y Places reales.

### 3. Crear las tablas y cargar datos de ejemplo

```bash
npm run db:migrate   # aplica las migraciones
npm run db:seed      # carga 8 estacionamientos, tarifas y 22 reservas
```

### 4. Levantar todo

```bash
npm run dev
```

| Servicio | URL |
|---|---|
| Web | http://localhost:5173 |
| API | http://localhost:4000/api/v1 |
| Documentación de la API | http://localhost:4000/api/docs |

### Otros comandos

```bash
npm run setup               # install + migrate + seed, todo junto (base vacía)
npm run build               # build de producción del frontend
npm test                    # tests del backend
npm run db:studio           # Prisma Studio, para mirar la base
npm run db:reset            # borra y recrea la base (¡cuidado!)
```

Dentro de `backend/`:

```bash
npm run db:limpiar-pruebas  # limpia datos que dejó una corrida de tests interrumpida
npm run mp:diagnostico      # prueba las credenciales de Mercado Pago y un pago de prueba directo
npm run db:seed -- --forzar # vuelve a cargar los datos de ejemplo BORRANDO lo que haya
npm run db:crear-superadmin # crea un SUPERADMIN sin tocar nada más (el de producción)
```

El seed **se niega a correr si la base ya tiene usuarios**, salvo con
`--forzar`: borra todas las tablas, y así no hay forma de vaciar una base real
por un comando equivocado. En una base recién creada (`npm run setup`,
`npm run db:reset`) corre como siempre.

---

## Desplegar en Render

Tres servicios, definidos en `render.yaml` (raíz del repo) para crearlos de una
sola vez:

| Servicio | Tipo | Qué es |
|---|---|---|
| `spotnear-db` | PostgreSQL | La base. |
| `spotnear-backend` | Web Service (Node) | La API. Corre directo con `node src/server.js` (`npm start`): es JavaScript con ES modules, no hay TypeScript ni paso de compilación. |
| `spotnear-frontend` | Static Site | La web, compilada con Vite (`dist/`). |

### Qué hace cada build

- **Backend:** `npm ci --include=dev && npx prisma generate && npx prisma migrate deploy`.
  - `--include=dev`: Render corre el build con `NODE_ENV=production`, y así
    npm se saltea las devDependencies. El CLI de Prisma es una; sin esto,
    `npx prisma` bajaría al vuelo una versión cualquiera.
  - `migrate deploy` (no `migrate dev`) aplica las migraciones que ya están en
    `backend/prisma/migrations`: no crea migraciones nuevas ni resetea la base.
    Corre en cada despliegue, así la base queda siempre al día con el código.
  - **El seed no corre nunca solo.** Borra todas las tablas antes de cargar
    datos de ejemplo. Ver *El primer administrador*, más abajo.
- **Frontend:** `npm ci --include=dev && npm run build` (Vite es devDependency).
  Las rutas se reescriben a `index.html`: es una SPA, y sin eso volver de
  Mercado Pago a `/pago/:token` o recargar `/panel/reservas` daría 404.

### Paso a paso

1. **Subí el repo a GitHub** con `render.yaml` incluido (`git push`). Los
   `.env` no se suben: están en `.gitignore`.
2. En [dashboard.render.com](https://dashboard.render.com): **New → Blueprint**,
   conectá GitHub y elegí el repo. Render lee `render.yaml` y muestra los tres
   servicios.
3. Te pide las variables marcadas `sync: false`. Completá las que ya tengas
   (tabla de abajo); las demás se pueden dejar vacías y cargar después.
4. **Apply.** Render crea la base, compila y despliega. El backend aplica las
   migraciones en su build. Tarda unos minutos.
5. **Revisá las URLs que te asignó Render.** `render.yaml` asume
   `https://spotnear-backend.onrender.com` y `https://spotnear-frontend.onrender.com`.
   Si un nombre estaba tomado, Render le agrega un sufijo (`spotnear-frontend-x7k2`).
   En ese caso corregí:
   - en `spotnear-backend` → Environment: `CORS_ORIGINS` y `PUBLIC_WEB_URL` con
     la URL real del frontend;
   - en `spotnear-frontend` → Environment: `VITE_API_URL` con la URL real del
     backend + `/api/v1`, y después **Manual Deploy** (las `VITE_*` se graban al
     compilar).
6. Abrí `https://<backend>/api/v1/health`: tiene que decir `"base": "ok"`. Y
   `/api/v1/config` tiene que decir `"vueltaAutomatica": true`.
7. **Creá el primer administrador** (abajo) y entrá a `https://<frontend>/panel/ingresar`.
8. **Google Maps:** en Google Cloud, agregá `https://<frontend>/*` a los
   referrers permitidos de la API key. Sin eso el mapa no carga en producción.

Si el backend no arranca, mirá **Logs**: con `NODE_ENV=production` se niega a
arrancar si `PUBLIC_WEB_URL`, `PUBLIC_API_URL` o `CORS_ORIGINS` siguen en
localhost, y dice cuál falta. El build del frontend hace lo mismo con
`VITE_API_URL`.

### Variables que se completan a mano (`sync: false`)

**Backend (`spotnear-backend`)**

| Variable | ¿Obligatoria? | De dónde sale |
|---|---|---|
| `MERCADOPAGO_ACCESS_TOKEN` | **Sí** (sin ella no se puede reservar) | [mercadopago.com.ar/developers/panel/app](https://www.mercadopago.com.ar/developers/panel/app) → tu aplicación → *Credenciales de producción* (`APP_USR-…`). Para probar en Render antes de cobrar de verdad, las *Credenciales de prueba*: el panel actual las da como `APP_USR-…` de una cuenta de prueba que crea solo (las viejas `TEST-…` de tu cuenta real también funcionan). SpotNear distingue prueba de producción preguntándole a Mercado Pago si la cuenta es de prueba, no por el prefijo. |
| `MERCADOPAGO_PUBLIC_KEY` | No (Checkout Pro no la usa) | Mismo lugar, al lado del access token. |
| `MERCADOPAGO_WEBHOOK_SECRET` | No, recomendada | Panel de Mercado Pago → tu aplicación → *Webhooks* → *Configurar notificaciones* → URL `https://<backend>/api/v1/payments/mercadopago/webhook`, evento *Pagos* → *Clave secreta*. Sin ella el webhook igual funciona: el estado del pago se relee siempre contra la API. |
| `CLOUDINARY_CLOUD_NAME` · `CLOUDINARY_API_KEY` · `CLOUDINARY_API_SECRET` | **Sí, para que haya fotos** | [console.cloudinary.com](https://console.cloudinary.com) → *Dashboard* → *API Keys*. Paso a paso en *Fotos de los estacionamientos*. Sin ellas el alta funciona igual, pero sin fotos. |
| `RESEND_API_KEY` | Para mandar emails | [resend.com/api-keys](https://resend.com/api-keys) → *Create API Key*. Ver *Emails*. |
| `SMTP_HOST` · `SMTP_USER` · `SMTP_PASS` | No (alternativa a Resend) | Los de tu casilla. Con Resend, dejalas vacías. |
| `TWILIO_ACCOUNT_SID` · `TWILIO_AUTH_TOKEN` | Para WhatsApp automático | [console.twilio.com](https://console.twilio.com) → *Account Info*. Además cambiá `WHATSAPP_PROVIDER` a `twilio`. |
| `WHATSAPP_PHONE_NUMBER_ID` · `WHATSAPP_ACCESS_TOKEN` | Solo con `cloud_api` | Meta for Developers → tu app → WhatsApp → *API Setup*. |
| `WHATSAPP_GRUPO_PRUEBA` | **No: dejala vacía en producción** | Pisa el grupo de todos los estacionamientos; es solo para pruebas. |
| `PUBLIC_API_URL` | **No: dejala vacía** | Si está vacía, el backend usa `RENDER_EXTERNAL_URL`, que Render completa solo con la URL pública real del servicio. Cargala solo si le ponés un dominio propio a la API. |

Las demás ya vienen resueltas en `render.yaml`: `DATABASE_URL` (la conecta el
Blueprint a `spotnear-db`), `JWT_SECRET` y `JWT_REFRESH_SECRET` (Render genera
valores aleatorios), `NODE_ENV=production`, `PAYMENT_PROVIDER=mercadopago`,
`CORS_ORIGINS`, `PUBLIC_WEB_URL`, `TZ`, `MONEDA`, comisión, límites de pedidos
y versión de Node. `PORT` no se carga: lo asigna Render.

**Frontend (`spotnear-frontend`)**

| Variable | ¿Obligatoria? | De dónde sale |
|---|---|---|
| `VITE_GOOGLE_MAPS_API_KEY` | No (sin ella hay un mapa alternativo) | Google Cloud → *APIs y servicios* → *Credenciales*. Ver *Google Maps*. Restringila al dominio del frontend. |
| `VITE_GOOGLE_MAPS_MAP_ID` | No (vacía usa `DEMO_MAP_ID`) | Google Cloud → *Map Management* → *Create Map ID* (tipo JavaScript). |
| `VITE_WHATSAPP_SOPORTE` | Recomendada | El número de soporte que aparece en "Contacto", con código de país (`+54911…`). |

`VITE_API_URL` ya viene en `render.yaml` (`https://spotnear-backend.onrender.com/api/v1`);
corregila solo si la URL del backend es otra.

### El webhook de Mercado Pago, resuelto de raíz

En Render el backend tiene una URL https pública, así que las tres cosas que en
local necesitaban un túnel funcionan solas, sin configurar nada en Mercado Pago:

- **Webhook:** cada preferencia lleva `notification_url = PUBLIC_API_URL + /api/v1/payments/mercadopago/webhook`.
- **Vuelta automática** al terminar de pagar: la `back_url` es https.
- **Imagen del comprobante por WhatsApp:** Twilio la puede descargar.

Ninguna de esas URLs está escrita en el código: salen de `PUBLIC_API_URL` (o de
`RENDER_EXTERNAL_URL`), y CORS sale de `CORS_ORIGINS`. `localhost` solo aparece
como valor por defecto para desarrollo, y en producción el backend no arranca
con él.

### El primer administrador (y el seed)

La base de Render arranca vacía, y **no conviene correr el seed ahí**: borra
todas las tablas y carga estacionamientos y usuarios de demo con claves
conocidas. Lo que hace falta en producción es un único SUPERADMIN, para entrar
al panel y aprobar estacionamientos. Para eso está
`npm run db:crear-superadmin`, que no borra nada y no tiene clave por defecto.

El plan free de Render no tiene consola (*Shell*), así que se corre **desde tu
máquina, contra la base de Render**:

1. Render → `spotnear-db` → *Connections* → copiá la **External Database URL**.
2. En una terminal, dentro de `backend/` (PowerShell):

   ```powershell
   $env:DATABASE_URL = "<External Database URL>"
   $env:SEED_SUPERADMIN_EMAIL = "vos@tudominio.com"
   $env:SEED_SUPERADMIN_PASSWORD = "una-clave-larga-y-unica"
   npm run db:crear-superadmin
   ```

   (En bash: `DATABASE_URL="…" SEED_SUPERADMIN_EMAIL="…" SEED_SUPERADMIN_PASSWORD="…" npm run db:crear-superadmin`.)
3. Cerrá esa terminal: las variables quedan solo en esa sesión, y tu `.env`
   local sigue apuntando a tu base de desarrollo.

Si Prisma se queja de SSL, agregá `?sslmode=require` al final de la URL. Correrlo
dos veces no hace daño: si el email ya existe, avisa y no toca nada.

**Si igual querés los datos de ejemplo** (por ejemplo, en un entorno de demo,
nunca en el de clientes reales): mismo procedimiento, con `npm run db:seed`
sobre la base recién creada. Si la base ya tiene usuarios, el seed se niega;
`npm run db:seed -- --forzar` la vacía y la recarga. Con un plan pago de Render,
lo mismo se puede correr desde el *Shell* del backend.

### Límites del plan free que conviene saber

- **El backend se duerme** tras 15 minutos sin tráfico, y la primera visita
  tarda ~1 minuto en despertarlo. Antes, la primera búsqueda mostraba "No
  pudimos conectarnos con el servidor" y recién al recargar andaba. Ahora:
  - al abrir el sitio se manda un pedido liviano a `/health`, así el backend
    empieza a despertar mientras la persona elige destino y horario;
  - las **consultas (GET)** se reintentan solas durante ~1 minuto con esperas
    crecientes (1, 2, 4, 7, 10, 15 y 20 s), también cuando Render responde
    502/503/504 mientras levanta o cuando una consulta se pasa del tiempo; la
    búsqueda tiene 45 s de timeout por intento;
  - mientras tanto se ve el esqueleto de carga y un aviso abajo: "Estamos
    despertando el servidor, puede tardar hasta un minuto la primera vez".
  Los POST (crear una reserva, pagar) no se reintentan tanto: no se repite algo
  que pudo haberse procesado. **Esto mitiga, no resuelve:** la causa es el
  plan gratuito. Un plan pago (*Starter*) no duerme el servicio y elimina el
  problema de raíz. Si en ese rato llega un webhook de Mercado Pago, Mercado
  Pago lo reintenta, y la pantalla de pago confirma la seña por su cuenta: no
  se pierde nada.
- **La base free vence a los 30 días** de creada (Render la borra si no se
  pasa a un plan pago). Antes de tener clientes reales, pasala a un plan pago,
  o usá otra base (por ejemplo la de Neon de desarrollo, poniendo su URL en
  `DATABASE_URL` en vez de la de `spotnear-db`).
- **El disco del servicio se borra** en cada deploy y cada vez que se
  duerme. Por eso las fotos ya **no** se guardan ahí: van a Cloudinary (ver
  *Fotos de los estacionamientos*). El backend no escribe ningún archivo en su
  disco.

---

## Google Maps: cómo obtener y restringir la API key

1. Entrá a [Google Cloud Console](https://console.cloud.google.com/) y creá un
   proyecto (o elegí uno existente).
2. **Activá la facturación.** Google Maps no renderiza sin una cuenta de
   facturación asociada, aunque el consumo entre en el crédito mensual gratuito.
3. En **APIs y servicios → Biblioteca**, habilitá:
   - **Maps JavaScript API** → dibuja el mapa.
   - **Places API (New)** → autocompletado de direcciones.
     ⚠️ Tiene que ser la versión **(New)**. La "Places API" vieja está deprecada
     para proyectos creados desde marzo de 2025 y no sirve.
4. En **APIs y servicios → Credenciales**, creá una **Clave de API**.
5. **Restringila** (importante: la key viaja al navegador, es pública):
   - *Restricciones de aplicación* → **Sitios web**, y agregá:
     - `http://localhost:5173/*`
     - `https://tudominio.com.ar/*`
   - *Restricciones de API* → **Restringir clave**, y dejá marcadas solo
     *Maps JavaScript API* y *Places API (New)*.
6. Poné la key en `frontend/.env` como `VITE_GOOGLE_MAPS_API_KEY`.
7. **Map ID** (opcional pero recomendado): los marcadores con el precio usan
   *Advanced Markers*, que requieren un Map ID. Creá uno en
   **Google Maps Platform → Map Management** (tipo *JavaScript*, *Vector*) y
   cargalo en `VITE_GOOGLE_MAPS_MAP_ID`. Sin un Map ID válido el mapa puede
   quedar en gris y los marcadores no aparecen.

---

## Usuarios de prueba

Los crea el seed. **Solo para desarrollo**: cambiá las contraseñas antes de
poner esto en producción.

| Rol | Email | Contraseña | Alcance |
|---|---|---|---|
| `SUPERADMIN` | `admin@spotnear.com.ar` | `SpotNear2026!` | Toda la plataforma |
| `OWNER` | `dueno@estacionamientohumboldt.com.ar` | `Humboldt2026!` | Estacionamiento Humboldt 650 |
| `STAFF` | `playero@estacionamientohumboldt.com.ar` | `Playero2026!` | Reservas de Humboldt 650 |
| `OWNER` (2) | `dueno@arenapark.com.ar` | `ArenaPark2026!` | Arena Park · Darwin 1180 |

> El segundo OWNER está a propósito: sirve para comprobar a mano que un
> estacionamiento **no ve** las reservas del otro.

Se pueden cambiar desde `backend/.env` (`SEED_*`) antes de correr el seed.

---

## Estructura del proyecto

```
spotnear/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          Modelo de datos
│   │   ├── migrations/            Migraciones versionadas
│   │   ├── seed.js                Datos de ejemplo
│   │   └── limpiar-pruebas.js     Limpieza post-tests
│   ├── src/
│   │   ├── config/                env validado con Zod + cliente Prisma
│   │   ├── middleware/            auth, validación, errores, rate limit
│   │   ├── modules/               auth · parkings · reservations · rates
│   │   │                          onboarding · staff · reports · payments
│   │   ├── services/              precios, capacidad, notificaciones,
│   │   │                          pagos (Mercado Pago), QR, auditoría
│   │   ├── utils/                 patente, teléfono, dinero, fechas, CSV, geo
│   │   ├── docs/openapi.js        Especificación de la API
│   │   ├── app.js                 App Express (exportada, para los tests)
│   │   └── server.js              Punto de entrada
│   └── tests/                     unit/ + integration/
│
├── frontend/
│   ├── public/assets/             Logo, hero, favicon, fotos placeholder
│   └── src/
│       ├── components/
│       │   ├── ui/                Campo, Iconos, Estado, Modal, Badge…
│       │   ├── layout/            Header, Footer, Logo
│       │   ├── busqueda/          Buscador de direcciones y selector de período
│       │   ├── resultados/        Tarjeta, filtros, mapa
│       │   ├── mapas/             Carga de Google Maps
│       │   └── admin/             Tabla de reservas, gráfico, búsqueda rápida
│       ├── pages/                 Públicas + pages/admin/
│       ├── layouts/               LayoutPublico · LayoutAdmin
│       ├── services/              Cliente HTTP + servicios de dominio
│       ├── context/               Auth · Toasts
│       ├── hooks/                 usePedido, useBusqueda, useAccionesReserva…
│       ├── utils/                 formato, validaciones, imagen del comprobante
│       ├── i18n/textos.js         **Todos los textos de la interfaz**
│       └── styles/                variables.css · reset.css · global.css
│
├── images/                        Assets originales de marca
└── package.json                   Scripts que levantan backend + frontend
```

---

## Cómo se da de alta un estacionamiento

Hay dos caminos, y los dos terminan en el mismo lugar.

### A. El dueño se registra solo (autogestión)

1. Entra a **`/registrar-estacionamiento`** (link en el header y en el pie).
2. Completa tres pasos: sus datos, los del estacionamiento (dirección con Google
   Places y marcador ajustable) y las condiciones, donde ve escrita la
   **comisión del 20%** y tiene que aceptarla explícitamente.
3. Al enviar se crean de una sola vez el `Parking` y su usuario `OWNER`, pero
   **apagados**: `estado = PENDIENTE_APROBACION`, `activo = false` y
   `publicado = false`. Eso significa que no aparece en ninguna búsqueda y que
   el dueño todavía no puede entrar al panel.
4. Le llega un email de acuse de recibo.

### B. ColdevIA lo carga a mano

Panel → **Estacionamientos** → *Nuevo estacionamiento*. Nace directamente en
`estado = ACTIVO`, porque lo cargó alguien de confianza.

### La aprobación

Panel → **Solicitudes** (solo SUPERADMIN). Cada solicitud muestra los datos del
dueño y del estacionamiento, y dos botones:

- **Aprobar y publicar** → pasa a `ACTIVO`, se publica, se habilita el usuario
  dueño y le llega un email avisándole que ya puede entrar.
- **Rechazar** → queda marcado como `RECHAZADO` con el motivo. **No se borra
  nada**: el registro sigue ahí y se puede revisar o revertir después. Al dueño
  le llega un email con el motivo, si cargaste uno.

> ⚠️ **Aprobar no alcanza para que aparezca en la búsqueda.** Sin al menos una
> tarifa por hora el estacionamiento no puede cotizar, y la búsqueda lo saltea
> en silencio. Esto está avisado en la propia pantalla de solicitudes y en el
> email de aprobación.

---

## Horarios: los tres modos de cierre

No todos los estacionamientos cierran igual, y los tres casos conviven. Cada uno
declara el suyo en la columna `tipoHorario`:

| Modo | Qué significa | Qué se guarda |
|---|---|---|
| `FIJO` | Abre y cierra a una hora, distinta por día | `abre` y `cierra` por día |
| `ABIERTO_24HS` | Nunca cierra | `{ abierto24h: true }` |
| `FIN_EVENTO` | Abre a una hora fija y cierra cuando termina el evento | solo `abre` por día |

`FIN_EVENTO` es el caso de los que están pegados a un estadio: la salida la
marca el show, no el reloj. Al reservar solo se valida que no se ingrese antes
de abrir; no hay hora de cierre contra la cual validar, y **inventar una sería
peor que no tenerla**. En el seed lo usa Arena Park, a 300 m del Movistar Arena.

El modo se elige con tres tarjetas excluyentes (radios, no checkboxes) tanto en
el formulario público de alta como en Panel → Mi estacionamiento. Los campos de
hora aparecen y desaparecen según el modo, y nunca se ven los de dos modos a la vez.

> El enum de Prisma no admite un valor que empiece con dígito, así que el modo
> de 24 horas se llama `ABIERTO_24HS` y no `24HS`. La migración
> `tipo_horario` hace el backfill: los estacionamientos que ya tenían
> `abierto24h: true` pasaron solos a `ABIERTO_24HS`, el resto a `FIJO`.

---

## Fotos de los estacionamientos

Las fotos se suben **desde el dispositivo** (arrastrar y soltar o el selector de
archivos), con vista previa y opción de quitar antes de mandar el formulario.
Pegar una URL sigue estando, pero como alternativa plegada.

**Al menos una foto es obligatoria** para dar de alta un estacionamiento, y se
valida en el backend además del formulario: el endpoint es público y cualquiera
puede postear sin pasar por la web. **Excepción:** si Cloudinary no está
configurado, no hay dónde subirlas, así que pasan a ser opcionales (ver abajo).

- **Endpoint**: `POST /api/v1/onboarding/fotos` (multipart, campo `fotos`).
- **Límites**: 8 fotos, 5 MB cada una, JPG/PNG/WebP/AVIF/HEIC. Cloudinary las
  achica a 1600 px de lado como máximo.
- **Dónde quedan**: en **Cloudinary**, carpeta `spotnear/parkings`. En la base
  (`ParkingPhoto.url`) se guarda solo la URL pública
  (`https://res.cloudinary.com/...`), que el frontend usa tal cual.

### Por qué Cloudinary y no el disco

En Render el disco de un Web Service es **efímero**: se borra en cada deploy y
cada vez que el plan gratuito duerme el servicio. Las fotos se perdían y en la
base quedaban URLs rotas. Guardarlas en la base tampoco: la infla y la vuelve
lenta. Ahora el archivo pasa por la memoria del backend y va directo a
Cloudinary; el backend no escribe nada en su disco, así que **un redeploy no
borra ninguna foto**.

La imagen del comprobante (la del QR) no necesitó este cambio: **no se guarda
en ningún lado**, se dibuja en el momento a partir de la reserva cada vez que
se pide (`GET /reservations/comprobante/:token/comprobante.png`). Sobrevive
a cualquier redeploy porque lo único que necesita es la base.

### Crear la cuenta de Cloudinary y sacar las tres credenciales

1. Entrá a [cloudinary.com/users/register_free](https://cloudinary.com/users/register_free)
   y creá una cuenta gratis (con Google o con email). El plan *Free* alcanza de
   sobra para las fotos de esta etapa.
2. Si te pregunta para qué la vas a usar, elegí cualquier opción (por ejemplo
   *Programmable Media*); no cambia nada.
3. Entrá a [console.cloudinary.com](https://console.cloudinary.com). En el
   *Dashboard* (o en *Settings → API Keys*) vas a ver:
   - **Cloud name** → `CLOUDINARY_CLOUD_NAME`
   - **API Key** → `CLOUDINARY_API_KEY`
   - **API Secret** (tocá el ojo para verlo) → `CLOUDINARY_API_SECRET`
4. Cargalas en Render: *spotnear-backend → Environment → Add Environment
   Variable*, una por una, y guardá (Render redeploya solo).
5. Para desarrollo, las mismas tres en `backend/.env` y reiniciá el backend.
6. Probalo: en `GET /api/v1/config` tiene que aparecer
   `"fotos": { "configurado": true }`, y en *¿Tenés un estacionamiento?* la
   zona de "Arrastrá tus fotos acá" vuelve a aparecer.

El API Secret es una credencial: va solo en variables de entorno, nunca en el
código ni en el frontend.

### Subir fotos desde el panel

*Mi estacionamiento → Fotos → Agregar foto* ahora deja **elegir archivos** del
dispositivo (además de pegar un link). Van a Cloudinary igual que las del alta
(`POST /admin/parkings/:id/fotos/archivos`), con el aislamiento por
estacionamiento validado antes de leer el archivo. Es la forma de reponer las
fotos que se perdieron cuando vivían en el disco de Render.

Las fotos de ejemplo del seed son archivos del frontend
(`/assets/parkings/*.svg`), no del disco del backend: no se pierden.

### Si Cloudinary no está configurado

No se rompe nada. `GET /config` devuelve `fotos.configurado: false` y el
formulario de alta, en vez de la zona de carga, muestra el aviso "La subida de
fotos todavía no está disponible", con la opción de pegar links. Las fotos pasan
a ser opcionales (en el formulario y en el backend): trabar el alta de un
estacionamiento por un problema de configuración nuestro sería peor que
recibirla sin fotos. Si alguien igual le pega al endpoint de subida, responde
**503** `ALMACENAMIENTO_NO_CONFIGURADO` con ese mismo mensaje, al instante y
sin leer el archivo.

Las fotos que se subieron en desarrollo antes del cambio siguen en
`backend/uploads/` y se siguen sirviendo en `/uploads/...` (solo lectura). Las
que se habían subido a Render ya se habían perdido con el disco: esos
estacionamientos hay que volver a cargarles fotos.

Se suben apenas se eligen y no al mandar el formulario, así el dueño ve la
miniatura al instante y se entera ahí si una pesa de más.

Como el endpoint es público y sin cuenta, se toman precauciones: el nombre del
archivo lo inventa el servidor (nunca se usa el del cliente), solo se aceptan
cinco tipos de imagen, hay límite de tasa propio, y los archivos se sirven con
`nosniff` y una CSP restrictiva para que nada disfrazado de imagen se ejecute.

Todo vive en `backend/src/services/uploads.js`: el resto del código
únicamente ve la URL que devuelve.

---

## Cómo se calcula el precio

En `backend/src/services/pricing.js`. La lógica sigue el uso real de los
estacionamientos porteños: no se cobra hora por hora indefinidamente, hay
escalones con precio fijo.

### Los escalones

Se parte del **valor de la hora** del estacionamiento (el de la tarifa que
corresponde al tipo de vehículo de la reserva, si tiene una específica):

| Duración | Qué se cobra | Cuenta |
|---|---|---|
| menos de 4 h | por hora, redondeando hacia arriba | `hora × horas` |
| de 4 a 12 h | **media estadía** | `hora × 4` |
| de 12 a 24 h | **estadía completa** | `hora × 5` |
| más de 24 h | el ciclo se reinicia | una estadía completa por cada bloque entero de 24 h + el escalón que corresponda al resto |

Las horas se redondean hacia arriba antes de mirar el escalón, con un mínimo de
una hora.

**Las 12 horas exactas son estadía completa, no media estadía.** El borde tenía
que caer para algún lado y cae para arriba: los intervalos son `[4, 12)` para la
media y `[12, 24)` para la completa; las 24 h exactas reinician el ciclo y se
cobran como una estadía completa, que da el mismo importe. Está en las constantes
`HORAS_MEDIA_ESTADIA` y `HORAS_ESTADIA_COMPLETA` y cubierto por un test propio
(`tests/unit/pricing.test.js`, "las 12 horas exactas ya son estadía completa").

Con la hora a $2.000 queda así: 1 h $2.000 · 3 h $6.000 · 4 h $8.000 ·
11 h $8.000 · 12 h $10.000 · 24 h $10.000 · 29 h $18.000 (un día + 5 h de media
estadía) · 48 h $20.000 · 50 h $24.000.

La propiedad que garantiza el modelo es que **dejar el auto más tiempo nunca
sale más barato**, y hay un test que la recorre de punta a punta.

### Lo que se cobra encima

- **Tarifa por día**: si el estacionamiento la tiene cargada, se cobra **lo más
  barato** entre los escalones y el precio por día. El escalón no puede
  encarecer nada respecto de la tarifa diaria que el dueño ya publicó.
- **Mensual**: precio fijo por mes iniciado; es una modalidad aparte, no compite
  con los escalones.
- **Comisión**: el 20% se calcula **sobre el precio que resulta de los
  escalones** y se suma al total. El escalón define lo que cobra el
  estacionamiento; la comisión es lo que paga el cliente por encima.

Una tarifa atada a un tipo de vehículo (por ejemplo, motos) aplica **solo** si se
pidió ese tipo. Si el cliente todavía no eligió vehículo, se cotiza con la
tarifa general, y si el estacionamiento solo tiene tarifas por tipo se usa la de
auto o, en su defecto, la más barata: mostrar el precio de moto a quien busca
para un auto sería prometer algo que después no se cumple.

**El precio se congela en la reserva.** Si mañana el estacionamiento sube la
tarifa, la reserva ya hecha mantiene el precio pactado.

---

## Cobro: la seña no reembolsable

### Quién paga qué, y cuándo

El cliente paga **dos veces**, en dos momentos y a dos destinatarios distintos:

```
Estacionamiento (lo paga allá)   $26.000   ← íntegro, al dueño, al llegar
Seña para reservar (la paga acá)  $5.200   ← 20%, online, no se devuelve
──────────────────────────────────────────
Total de la reserva              $31.200
```

La seña **se suma, no se descuenta**. El estacionamiento recibe el 100% de su
tarifa, directo del cliente, como hacía antes de que existiera SpotNear. La
plataforma no intermedia ese cobro, y por lo tanto **no le transfiere nada al
dueño**: no hay liquidaciones que esperar.

Lo único que cobra SpotNear es la seña, y la cobra online al confirmar la
reserva. **Sin seña no hay reserva**: si el cobro no entra, no se genera el
código ni el QR.

### Cómo se calcula

La seña es el 20% (configurable por estacionamiento) **sobre el precio que sale
del cálculo por escalones**, nunca sobre un valor recalculado aparte. Así los
dos números no se pueden desincronizar: si la estadía cae en media estadía y da
$26.000, la seña son $5.200 y punto. Hay un test que lo fija
(`tests/unit/pricing.test.js`, "la seña se calcula sobre el precio que salió de
los escalones").

El porcentaje se **congela en la reserva**: si mañana cambia, lo ya reservado no
se mueve.

**Del 10% al 20% (04/10/2026).** La migración `20261004100000_comision_20_por_ciento`
cambió el default de la columna a 20 y pasó a 20% todos los estacionamientos que
estaban en 10% (en producción, todos). Las reservas ya hechas conservan el
porcentaje con el que se reservaron. También cambiaron el default de
`COMISION_DEFAULT_PORCENTAJE`, el motor de precios, el alta desde el panel, el
seed y todos los textos (condiciones del registro, páginas informativas,
ejemplos numéricos).

### Cómo se lo nombra en cada pantalla

Esto no es cosmético, es la regla:

| Dónde | Cómo se llama |
|---|---|
| Checkout, comprobante, emails, WhatsApp al cliente | **"seña para reservar"**, siempre con "no reembolsable" al lado |
| Panel (SUPERADMIN / OWNER), reportes, base de datos | "comisión", "seña cobrada", lo que retiene SpotNear |

De cara al cliente **nunca** se dice que ese 20% es una comisión ni que va a
SpotNear: para él es la seña que aparta su lugar. En las columnas de la base los
nombres siguen siendo `montoComision` y `comisionPorcentaje` porque son los de
siempre y los que usan las pantallas internas; renombrarlos habría obligado a
migrar datos para no ganar nada.

### Pasarela de pago: Mercado Pago (Checkout Pro)

```bash
PAYMENT_PROVIDER=simulado     # default
```

La pasarela cobra **únicamente la seña** (`montoDeCobro()` en
`backend/src/services/payments/index.js` devuelve `montoComision`, no
`precioTotal`). Cobrar el total sería quedarse con plata que no es de la
plataforma.

| Valor | Qué hace | ¿La reserva nace confirmada? |
|---|---|---|
| `simulado` | Da la seña por cobrada al instante, sin cobrar nada. Avisa por consola en cada cobro. Permite probar el flujo completo sin credenciales. | Sí |
| `mercadopago` | Cobro real con Checkout Pro. | **No**: nace `PENDIENTE` y se confirma cuando la seña se acredita |
| `none` | Sin pasarela: la seña queda `PENDIENTE` de cobro. | Sí |

En modo simulado el checkout lo dice en pantalla, para que nadie crea que entró
plata de verdad.

#### Para activarlo hacen falta dos líneas

```bash
# backend/.env
PAYMENT_PROVIDER=mercadopago
MERCADOPAGO_ACCESS_TOKEN=TEST-...    # o APP_USR-... en producción
```

Las credenciales salen del panel de desarrolladores de Mercado Pago:
**[mercadopago.com.ar/developers/panel/app](https://www.mercadopago.com.ar/developers/panel/app)
→ tu aplicación → Credenciales**. Hay dos juegos y **no se mezclan**:

| | Access token | Con qué se paga | Plata |
|---|---|---|---|
| **Prueba (sandbox)** | empieza con `TEST-` | las tarjetas de prueba de Mercado Pago | no se mueve un peso |
| **Producción** | empieza con `APP_USR-` | tarjetas reales | real |

El access token es **secreto y vive solo en el `.env` del backend**: nunca se
manda al navegador. La public key sí podría ir al frontend, pero hoy no se usa:
Checkout Pro no la necesita (la pide Payment Bricks, si algún día se migra al
checkout embebido en la misma página).

Sin el access token cargado el sistema **no se rompe**: el checkout muestra "el
pago en línea no está disponible en este momento", el botón de confirmar queda
deshabilitado y el POST de reserva responde 503 sin crear nada. Es a propósito
que falle *antes* de tocar la base: dejar reservas colgadas esperando un cobro
que nunca se va a poder hacer es peor que no dejar reservar.

#### Cómo se valida que el pago entró

**Nunca por lo que diga el navegador.** Mercado Pago devuelve al cliente a
`/pago/:token` con un `?status=approved` en la URL, y eso lo escribe
cualquiera. El estado se lee **siempre contra la API de Mercado Pago**, con
nuestro access token, por dos caminos que se complementan:

1. **El webhook** (`POST /api/v1/payments/mercadopago/webhook`). Es el
   confiable: no depende de que el cliente vuelva al sitio. Hace falta porque un
   pago en efectivo se acredita horas después, con el navegador cerrado. El
   aviso trae solo un id de pago y el estado se consulta a la API, así que **un
   aviso falso no puede confirmar nada**: lo peor que logra es hacernos
   consultar un pago que no existe. Si además está cargado
   `MERCADOPAGO_WEBHOOK_SECRET`, se valida la firma `x-signature` (HMAC-SHA256,
   comparada en tiempo constante) y los avisos que no la traen se descartan.
   Siempre se responde `200`, incluso ante un error nuestro: un `500` haría que
   Mercado Pago reintente el mismo aviso durante horas.

2. **La consulta directa** (`GET /reservations/comprobante/:token/pago`). La
   pantalla de pago la llama cada 4 segundos mientras espera, y **no es pasiva**:
   le pregunta a Mercado Pago y, si el pago está aprobado, confirma la reserva en
   ese mismo momento. Es lo que hace que un webhook perdido no deje una reserva
   colgada, y lo que permite probar el flujo entero en desarrollo.

Los dos caminos terminan en la misma función, `acreditarSenaYAvisar()`, que es
idempotente: si el webhook y la consulta llegan a la vez, el comprobante y el
aviso al estacionamiento salen **una sola vez**. La garantía es un `updateMany`
condicionado a que la reserva todavía no esté pagada: decide la base, no el
código.

#### Los estados de Mercado Pago, y qué ve el cliente

| Mercado Pago | Nosotros | Qué ve el cliente |
|---|---|---|
| `approved` / `authorized` | `PAGADO` | El comprobante con el QR |
| `pending` / `in_process` | `PENDIENTE` | "Tu pago está en proceso" · el comprobante sale apenas se acredite |
| `rejected` / `cancelled` | `FALLIDO` | "El pago no se completó" · botón para reintentar |
| todavía no pagó | `PENDIENTE` | "Falta pagar la seña" · link al checkout |

Un estado desconocido cae en `PENDIENTE` a propósito: ante la duda se espera,
no se da la reserva por perdida.

**Un pago rechazado no cancela la reserva.** Queda `PENDIENTE` con el cobro en
`FALLIDO`, que es exactamente "rechazado, se puede reintentar"; cancelarla
obligaría al cliente a cargar todos los datos de nuevo por una tarjeta que no
pasó. El botón "Intentar de nuevo" arma una preferencia nueva sobre la misma
reserva.

#### Sin seña no hay comprobante, y no es solo una frase

Mientras la reserva esté esperando la seña (`esperandoLaSena()`):

- `GET /reservations/comprobante/:token` devuelve los datos pero con `qr: null`
  y `links: null`, y el frontend redirige a la pantalla de pago;
- `/qr.svg` y `/comprobante.png` responden **409**;
- **no sale ninguna notificación**: ni el comprobante al cliente ni el aviso al
  grupo del estacionamiento.

Eso último es el punto entero del modelo. Está fijado por tests
(`tests/integration/sena-mercadopago.test.js`) y verificado a mano contra la
base: una reserva creada sin poder cobrar la seña quedó con **0 filas** en
`NotificationLog`.

#### El lugar apartado tiene vencimiento

Entre que el cliente confirma y que paga, la reserva existe pero no está paga.
Durante ese rato **el lugar queda apartado** —si no, dos personas pagan por el
mismo lugar—, pero no para siempre: a los 30 minutos (`MINUTOS_PARA_APARTAR` en
`services/availability.js`) una reserva pendiente sin seña deja de ocupar lugar.
Coincide con el vencimiento de la preferencia de Mercado Pago.

Se resuelve **en la consulta de disponibilidad, no con una tarea programada**:
sin un proceso aparte que se pueda caer, y siempre exacto al momento de
preguntar.

#### El flujo, en dos pasos explícitos

1. **"Confirmar y pagar la seña"** (checkout): valida el formulario, crea la
   reserva en `PENDIENTE` —todavía no es una reserva: lo es cuando se acredita
   la seña— y lleva a `/pago/:token`, que dice **"Falta pagar la seña"** y
   "Para reservar tu lugar, pagá la seña ahora". No redirige a ningún lado: el
   cliente lo lee con tranquilidad.
2. **"Pagar la seña"** (en ese recuadro): recién ahí se crea la preferencia de
   Checkout Pro y se sale a Mercado Pago. Es el único camino a la pasarela.

La preferencia se crea en el segundo clic y no antes a propósito: vence a los
30 minutos, así que nace en el momento en que se va a usar. El mismo botón sirve
para reintentar después de un rechazo (`POST /comprobante/:token/pagar-sena`).

#### La vuelta a SpotNear: la regla real es https

**La causa de que el cliente se quedara en la pantalla de Mercado Pago** no era
que la URL de vuelta fuera "privada": era que era `http`. Probado contra la API
de preferencias, caso por caso:

| `back_urls.success` con `auto_return` | Mercado Pago |
|---|---|
| `http://localhost:5173/...` | ❌ `auto_return invalid. back_url.success must be defined` |
| `http://example.com/x` (pública, pero http) | ❌ el mismo error |
| `http://127.0.0.1.nip.io:4000/...` | ❌ el mismo error |
| `https://example.com/x`, con o sin puerto | ✅ |
| `https://127.0.0.1.nip.io/x` (apunta a tu máquina) | ✅ |

O sea: **cualquier https sirve y ningún http sirve**. Antes el código mandaba
`auto_return` solo si la URL "era pública", y la de la web es
`http://localhost:5173`: nunca se mandaba, y sin `auto_return` Mercado Pago
deja al cliente en su pantalla de "¡Listo!".

**Cómo quedó** (`services/payments/mercadopago.js` → `urlDeVuelta`):

1. La `back_url` (success, pending y failure) apunta a la **API**:
   `GET /api/v1/payments/mercadopago/vuelta/:token`, siempre que
   `PUBLIC_API_URL` sea https. Con `auto_return: "all"`.
2. Esa ruta le pregunta a Mercado Pago por el pago (con tope de 4 s) y, si está
   aprobado, **confirma la reserva ahí mismo** —comprobante y avisos, una sola
   vez aunque el webhook llegue en paralelo—. Después redirige a la web:
   `/pago/:token?vuelta=aprobado|pendiente|rechazado|sin-dato`.
3. `/pago/:token` muestra **"Confirmando tu pago..."** y consulta al backend
   cada 1,5 s durante 15 s. Apenas la seña figura acreditada, navega sola al
   comprobante con el QR: **cero clics**.
4. Si a los 15 s no se acreditó (un medio que demora): **"Tu pago está en
   proceso"**, con *Revisar de nuevo* y *Copiar el link de esta pantalla* para
   volver más tarde. La pantalla sigue consultando sola cada 4 s durante dos
   minutos más.

El `?vuelta=` de la URL **no decide nada**: lo puede escribir cualquiera. Solo
elige qué mostrar mientras se confirma. El estado sale siempre de la API de
Mercado Pago (hay un test que lo fija: una URL que dice "rechazado" no evita
que se confirme un pago que sí entró).

Que la vuelta pase por la API y no vaya directo a la web es a propósito: así
**el mismo camino sirve en producción y en desarrollo**. En desarrollo alcanza
con un túnel https hacia el backend; la web puede seguir en
`http://localhost:5173`. En producción `PUBLIC_API_URL` ya es https y no hay
que hacer nada.

**Qué hace Mercado Pago en cada caso** (observado en el sandbox, no supuesto):

| Resultado del pago | ¿Vuelve solo? | Qué ve el cliente en SpotNear |
|---|---|---|
| Aprobado | **Sí**, a los ~5 s de la pantalla "¡Listo!" (la documentación dice "hasta 40 s") | "Confirmando tu pago..." → comprobante con QR |
| En proceso (tarjeta en revisión) | No: muestra "Estamos procesando tu pago" con **"Ok, entendido"**, que vuelve | "Confirmando tu pago..." → a los 15 s "Tu pago está en proceso" |
| Rechazado | No: ofrece "Pagar con otro medio" ahí mismo, y **"Volver al sitio"** | "El pago no se completó", con **Intentar de nuevo** |

Que los pendientes y rechazados no vuelvan solos aunque se pida
`auto_return: "all"` es decisión de Mercado Pago (le ofrece al comprador
reintentar sin salir). Lo que sí cambió es que ahora sus botones de salida
funcionan y llevan a una pantalla de SpotNear que explica qué pasó.

**Sin ninguna URL https** (desarrollo sin túnel), Mercado Pago no puede volver
solo. Para que el cliente no quede encerrado, el checkout se abre en **otra
pestaña** y la de SpotNear se queda esperando: consulta sola y muestra el
comprobante apenas se acredita (`/config → pago.vueltaAutomatica: false`).

**El pago nunca se pierde**, vuelva o no el cliente: el panel del
estacionamiento, al cargar el listado de reservas, le pregunta a Mercado Pago
por las señas del último día que siguen sin acreditar y confirma las que ya
están pagas.

#### Si el webhook tarda

No pasa nada: el webhook es **uno de tres caminos** que confirman la seña, y
los tres entran por la misma función idempotente (`acreditarSenaYAvisar`):

1. el webhook de Mercado Pago, cuando llega;
2. la ruta de vuelta, cuando el cliente vuelve del checkout;
3. el sondeo de la pantalla `/pago/:token`.

El primero que ve el pago aprobado confirma la reserva y dispara comprobante y
avisos; los demás la encuentran confirmada y no repiten nada.

**Probado con el webhook demorado a propósito** (un envoltorio de prueba que
retenía el aviso 25 s y además hacía que la vuelta no consultara a Mercado
Pago, el peor caso). El log del backend, en orden:

```
webhook demorado 25s: ...webhook?data.id=1352946525&type=payment
vuelta SIN consulta previa (approved) → ?vuelta=aprobado
[pagos] seña acreditada de SN-P3NJCN: se emite el comprobante...   ← la confirmó el sondeo
webhook liberado
POST .../webhook?data.id=1352946525&type=payment 200                ← llegó tarde y no duplicó nada
```

El cliente vio "Confirmando tu pago..." unos 2 s y después su comprobante.

#### Probar la vuelta automática y el webhook en tu máquina (pasos exactos)

Hace falta una URL https que llegue a tu backend. Lo más simple es el túnel
gratuito de Cloudflare, **que no pide cuenta** (ya quedó instalado en esta
máquina; en otra: `winget install Cloudflare.cloudflared`):

1. Con el backend corriendo en el 4000, en otra terminal:

   ```bash
   cloudflared tunnel --url http://localhost:4000
   ```

   Imprime una URL del estilo `https://algo-asi.trycloudflare.com`.
2. En `backend/.env`: `PUBLIC_API_URL=https://algo-asi.trycloudflare.com`.
   **Nada más**: `PUBLIC_WEB_URL` sigue en `http://localhost:5173` y el
   frontend no se toca.
3. Reiniciá el backend. En `/api/v1/config` tiene que decir
   `"vueltaAutomatica": true`.
4. Reservá y pagá con la tarjeta de prueba (titular `APRO`): Mercado Pago
   vuelve solo a SpotNear y aparece el comprobante. En la consola del backend
   vas a ver además `POST /api/v1/payments/mercadopago/webhook`: con el túnel,
   **el webhook también llega**.
5. Opcional: `MERCADOPAGO_WEBHOOK_SECRET` con la clave del panel de Mercado
   Pago → Webhooks, para validar la firma.

La URL del túnel **cambia cada vez** que lo levantás: actualizá
`PUBLIC_API_URL` y reiniciá. Al terminar, volvela a `http://localhost:4000`.
Con el túnel, además, la imagen del comprobante queda accesible desde internet,
que es lo que necesita Twilio para mandarla por WhatsApp (ver más abajo).

Titulares de la tarjeta de prueba `5031 7557 3453 0604` (venc. `11/30`, CVV
`123`, DNI `12345678`): `APRO` aprueba, `CONT` deja el pago en proceso,
`OTHE` lo rechaza. El pago en efectivo (Pago Fácil) no funciona en este
sandbox: Mercado Pago responde "No pudimos procesar tu pago".

#### Probado de punta a punta (03/10/2026)

Con la aplicación de prueba de Mercado Pago, un túnel https de Cloudflare
hacia una copia del backend, y el navegador:

| Caso | Reserva | Resultado |
|---|---|---|
| Aprobado, webhook en tiempo | `SN-T9PPHJ` | Pago `1352970093`. El webhook confirmó la reserva; Mercado Pago volvió solo a SpotNear; "Confirmando tu pago..." → comprobante con QR, sin un clic |
| Aprobado, webhook demorado 25 s | `SN-P3NJCN` | Lo confirmó el sondeo de la pantalla; el webhook llegó tarde y no duplicó avisos |
| Rechazado (`OTHE`) | `SN-3HQ97G` | "Volver al sitio" → "El pago no se completó" → *Intentar de nuevo* abrió un checkout nuevo |
| En proceso (`CONT`) | `SN-3HQ97G` | "Ok, entendido" → "Confirmando tu pago..." → a los 15 s "Tu pago está en proceso" |

Antes, el 29/09/2026, se había probado el camino sin webhook (la consulta
directa): reserva `SN-JFKTVM`, pago `1352790225`.

#### El bug del botón "Pagar" que no respondía

**Causa raíz**, confirmada con la consola y la pestaña de red: al apretar
"Pagar" en el checkout de Mercado Pago **no salía ninguna petición de pago**. No
fallaba nada —ni el webhook, que en local ni se manda, ni las `back_urls`, ni
las credenciales, que son todas de la misma aplicación de prueba—: el botón
directamente no actuaba. Pasa en dos casos, y los dos se probaron:

1. **Sin email del comprador.** Si la preferencia no trae `payer.email`,
   Mercado Pago lo pide en su pantalla de revisión; si queda vacío, su botón
   "Pagar" se ve habilitado pero no hace nada, sin ningún mensaje. Es lo que
   pasaba desde que se dejó de mandar el email arrastrado del contacto: el
   email del formulario era opcional y se dejaba vacío.
2. **Con el email de la cuenta vendedora.** Mercado Pago no deja pagarse a uno
   mismo, y lo detecta por el email, no por la sesión: probar en incógnito no
   cambia nada. Mismo síntoma.

Completando un email válido y distinto del de la cuenta, el mismo botón pagó al
primer clic.

**La solución** es que el cliente nunca llegue a ese botón muerto:

- Con Mercado Pago el email pasa a ser **obligatorio** en el checkout de
  SpotNear, con la aclaración de que lo pide Mercado Pago. Viaja en la
  preferencia y la pantalla de revisión ya no pide nada.
- Si es el email de la cuenta vendedora, el formulario lo rechaza con un
  mensaje que explica por qué. El backend lo consulta a la API de Mercado Pago
  (`GET /users/me`) una vez y lo cachea; si esa consulta falla, no bloquea.

Queda una trampa del sandbox que no se puede evitar desde el código: **para
probar, usá un email que no sea el de tu cuenta de Mercado Pago.** En producción
el comprador nunca es el dueño de la cuenta.

### Por qué ya no hay "Liquidaciones"

Existía una sección entera —ciclos semanales/mensuales, períodos cerrados,
pagos pendientes a dueños, una tabla `Payout`— pensada para el modelo anterior,
donde SpotNear cobraba el total y le giraba el resto al estacionamiento.

Con la seña, **no hay nada que liquidar**: el dueño ya cobró, en el lugar, en el
momento. Se eliminó todo (migración `20260928100000_sin_liquidaciones`): la
tabla, el enum de ciclos, la columna `cicloLiquidacion`, el servicio, las rutas,
la pantalla y la vista del dueño. La tabla estaba vacía, así que no se perdió
ningún dato.

**Se fusionó dentro de "Comisiones"** en vez de dejar un reporte nuevo: bajo
este modelo, lo que retiene SpotNear **es** su ingreso, así que dos pantallas
mostrarían el mismo número con distinto nombre.

---

## Eliminar cosas: qué se borra y qué se conserva

Tres cosas se pueden eliminar desde el panel, y las tres siguen el mismo
criterio: **donde hubo plata, la fila no se borra**.

| Qué | Sin plata de por medio | Con plata de por medio |
|---|---|---|
| **Estacionamiento** | Se borra la fila; la cascada limpia tarifas, fotos, campos extra y cupos | Queda anclado con `eliminadoEn`; su nombre y dirección se copian en cada reserva |
| **Reserva** | Solo terminadas (finalizada, cancelada, no se presentó). **Siempre borrado lógico**: queda con `eliminadaEn` | Igual: sigue contando en Comisiones y en su CSV |
| **Usuario** | Se borra siempre | Su nombre se copia en las reservas que cargó (`createdByNombre`) |

Que desaparezcan **de verdad** de todas las pantallas no se logró filtrando
consulta por consulta, sino con dos extensiones del cliente de Prisma
(`backend/src/config/prisma.js`) que inyectan `eliminadoEn: null` y
`eliminadaEn: null` en toda lectura de `Parking` y `Reservation`. Son decenas de
lugares que leen esas tablas y alcanza con que uno se olvide para que algo
reaparezca en una búsqueda. Quien necesita ver lo eliminado —el reporte de
ingresos— opta por incluirlo nombrando la columna en su propio `where`.

### Eliminar reservas terminadas

En **Reservas**, cada fila finalizada, cancelada o "no se presentó" tiene un
ícono de papelera al final (junto a WhatsApp y "ver detalle"); también está en
el detalle. Pide confirmación en un modal. Lo pueden usar el **OWNER** y el
**STAFF** de ese estacionamiento y el **SUPERADMIN**
(`DELETE /admin/reservations/:id`, con el filtro de tenant en la consulta: la
reserva de otro estacionamiento da 404).

- **Una pendiente, confirmada o en curso no se puede eliminar** (409
  `RESERVA_ACTIVA`): es actividad que todavía no pasó. Primero se cancela. La
  papelera ni aparece en esas filas.
- **Es un borrado lógico, siempre.** La reserva desaparece del listado, del
  detalle, de la búsqueda y del dashboard, pero **sigue contando en Comisiones
  y en su exportación CSV**: una reserva finalizada es facturación que existió,
  y el pedido era limpiar la lista, no reescribir lo facturado. El link del
  comprobante del cliente también sigue andando.
- Por qué siempre lógico y no "físico si no hubo plata", como era antes para el
  SUPERADMIN: una reserva **finalizada** cuenta en Comisiones aunque la seña no
  haya pasado por la pasarela (las cargadas desde el panel), así que borrarla de
  verdad cambiaría el reporte. Conservar la fila no cuesta nada y deja rastro
  ante cualquier reclamo. La acción queda en `AuditLog`.
- Antes, el CSV de Comisiones no incluía las reservas eliminadas y la pantalla
  sí: no coincidían. Corregido.

**Al eliminar un usuario** se cierran sus sesiones y se conserva su rastro en la
auditoría (`AuditLog.userId` es `SET NULL`). No se puede eliminar al último
SUPERADMIN activo: dejaría la plataforma sin nadie que pueda entrar.

---

## Emails: cómo hacer que salgan de verdad

**Diagnóstico del 04/10/2026: el código está completo; lo único que falta es la
API key.** Seguí la cadena entera: el botón "Enviar por email" del comprobante
llama a `POST /reservations/comprobante/:token/enviar-email`, que llama a
`notificarClienteEmail()` → `enviarEmail()` → la API de Resend. No hay ningún
`if` que lo desactive salvo el que pregunta si existe `RESEND_API_KEY`
(`env.resendHabilitado`): sin ella, el envío queda `SIMULADO` y el usuario ve
*"El envío de emails todavía no está configurado en este entorno"*. Para
confirmarlo se mandó un pedido real a la API de Resend con una key inválida, y
Resend respondió *"API key is invalid"*: el pedido sale y llega. Con una key
válida, el mail se envía.

**Qué cargar:** `RESEND_API_KEY` en Render (*spotnear-backend → Environment*) y
en `backend/.env` para local. Se saca en <https://resend.com/api-keys>. Pasos
completos abajo.

**Proveedor elegido: Resend.** Ya estaba integrado (es un `POST` con `fetch`,
sin dependencias) y lo que faltaba era que funcionara **con solo cargar la API
key**. Lo que lo impedía: sin un dominio verificado, Resend rechaza el
remitente `reservas@spotnear.com.ar` con un 403. Ahora, si pasa eso, el envío
se reintenta solo desde su remitente de prueba (`onboarding@resend.dev`) y
avisa en la consola que conviene verificar el dominio.

### Paso a paso

1. Creá una cuenta en [resend.com](https://resend.com) (gratis: 3.000 mails
   por mes). **El email con el que te registrás importa**: en modo prueba es la
   única casilla a la que Resend deja mandar.
2. Entrá a <https://resend.com/api-keys> → **Create API Key** → permiso
   *Sending access* → copiá la key (empieza con `re_`; se muestra una sola vez).
3. En `backend/.env`:

   ```bash
   RESEND_API_KEY=re_...
   ```

4. Reiniciá el backend. Al arrancar tiene que decir `Email: Resend` en vez de
   `SIMULADO`.

Con eso ya salen, **pero solo a la casilla de tu cuenta de Resend**. Para
probar, hacé una reserva poniendo ese email, o usá "Enviar por email" en el
comprobante con ese email. A cualquier otra dirección Resend responde 403 y el
comprobante lo dice: *"El envío de emails está en modo de prueba: por ahora solo
llega a la casilla de la cuenta de Resend"*.

### Para mandarle a cualquier cliente (producción)

1. Resend → **Domains** → *Add Domain* → `spotnear.com.ar` (o el que uses).
2. Cargá en el DNS del dominio los registros que te muestra (SPF, DKIM) y
   esperá a que diga *Verified*.
3. `MAIL_FROM="SpotNear <reservas@spotnear.com.ar>"` (con ese dominio).

Ya no hace falta tocar código.

### Alternativa: SMTP

Si preferís una casilla existente (Gmail, el hosting), en vez de Resend:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tucuenta@gmail.com
SMTP_PASS=una-contraseña-de-aplicación
```

Con Gmail hace falta una **contraseña de aplicación**, no la del correo. Si hay
key de Resend se usa Resend; si no, SMTP; si no hay ninguna, el mail queda
`SIMULADO`: se loguea en consola y el usuario ve *"El envío de emails todavía
no está configurado en este entorno"*. Nada se rompe.

### Dónde se manda un email

Todos pasan por `enviarEmail()`, así que con la key cargada funcionan todos:

| Email | Cuándo | A quién |
|---|---|---|
| Comprobante de reserva | Automático cuando se acredita la seña | Cliente |
| Comprobante de reserva | Botón "Enviar por email" del comprobante | La dirección que elija |
| Solicitud recibida | Al registrar un estacionamiento | Dueño |
| Solicitud aprobada | Al aprobarla el SUPERADMIN | Dueño |
| Solicitud rechazada | Al rechazarla, con el motivo | Dueño |

El comprobante va además con la **imagen del comprobante adjunta**
(`spotnear-SN-XXXXXX.png`): Gmail no muestra el QR embebido en el HTML (bloquea
las imágenes `data:`), y el adjunto es lo que el cliente muestra en la entrada.

**Lo que no se pudo probar:** un envío real, porque no hay una API key cargada.
Lo que sí está probado, con `fetch` simulado (`tests/unit/notificaciones.test.js`):
el pedido que se le manda a Resend, el adjunto en base64, el reintento con el
remitente de prueba ante el 403 de dominio, el error de modo prueba y el modo
`SIMULADO` sin key.

**Un envío que falla nunca tira abajo el flujo** que lo pidió, pero no falla en
silencio: deja en el servidor un bloque con destinatario, asunto y motivo, más
el registro en `NotificationLog`.

---

## WhatsApp automático al grupo del estacionamiento

El grupo del estacionamiento recibe el aviso con los datos de la reserva **en el
momento exacto en que la seña queda acreditada**, no antes. Para que salga
**solo**, sin que nadie toque nada, hace falta una API de WhatsApp de verdad: un
link `wa.me` solo prellena texto y exige que una persona apriete "Enviar".

### Cuándo sale, exactamente

```
cliente confirma  →  reserva PENDIENTE (sin seña)  →  (silencio total)
                                  ↓
                        paga la seña en Mercado Pago
                                  ↓
                     Mercado Pago dice "approved"
                                  ↓
                     ┌────────────┴────────────┐
            comprobante al cliente      aviso al grupo
             (WhatsApp + email)          (WhatsApp)
```

Los dos salen de la misma función —`acreditarSenaYAvisar()` en
`reservations.service.js`— y salen juntos. Es a propósito que sea **una sola**:
tener el "confirmar" en un lugar y el "avisar" en otro es exactamente cómo se
llega a una reserva confirmada de la que el estacionamiento nunca se enteró.

Con `PAYMENT_PROVIDER=simulado` o `none` la reserva se confirma al crearse, así
que el aviso sale ahí mismo: el momento es el mismo (cuando la reserva pasa a
existir), lo que cambia es cuándo ocurre eso.

**Si el aviso falla, la reserva no se cae.** El envío devuelve `PENDIENTE`,
queda el registro en `NotificationLog` y el servidor loguea qué falta
configurar. El aviso al grupo es un paso adicional: la reserva del cliente
depende únicamente de que la seña esté aprobada.

```bash
WHATSAPP_PROVIDER=link     # default: NO envía solo
```

| Valor | Qué hace |
|---|---|
| `link` | Arma el `wa.me` y lo devuelve. Una persona lo abre y lo manda. No automatiza nada. |
| `twilio` | **Envío automático desde el servidor.** Es el camino corto para arrancar. |
| `cloud_api` | Envío automático con la Cloud API de Meta. Más barato a escala, pero pide Business Manager con el número verificado y plantillas aprobadas. |

### Qué falta para activar WhatsApp (y cuánto tarda)

El código está terminado: el botón "Enviar a mi WhatsApp" y el aviso al grupo
mandan la imagen del comprobante por la API apenas hay credenciales. Lo que
falta es del lado de las cuentas, y **no es solo cargar una variable**, como el
email:

| Etapa | Qué hacés | Cuánto tarda | Qué se puede hacer |
|---|---|---|---|
| **1. Sandbox de Twilio** (para probar) | Crear la cuenta, activar el sandbox, cargar las 3 variables (pasos abajo). | Minutos. | Mandar a números que se **unieron al sandbox** mandando `join …`. Ni el cliente común ni un grupo pueden recibir. |
| **2. Número propio en producción** | En Twilio: *Messaging → Senders → WhatsApp senders*, registrar un número que no esté usado en WhatsApp, y vincularlo a una cuenta de **Meta Business**. | Días a un par de semanas. | Mandar a cualquier cliente. |
| **2b. Verificación del negocio en Meta** | En Meta Business Manager: *Configuración → Centro de seguridad → Verificación del negocio*. Pide razón social, CUIT, dirección y un documento o factura del negocio, y un dominio o teléfono verificable. | Unos días (a veces más, si piden documentación extra). | Sin verificar, Meta limita el número a pocas conversaciones por día. |
| **3. Plantilla aprobada** | Para escribirle a alguien que no te escribió en las últimas 24 h, WhatsApp exige una plantilla aprobada por Meta (el comprobante con imagen entra en la categoría *Utility*). | Minutos a 1 día. | El aviso automático del comprobante a cualquier cliente. |

Mientras tanto, sin credenciales, nada se rompe: el botón avisa que el envío no
está configurado y el cliente puede guardar la imagen o compartirla.

**Sobre los grupos de WhatsApp:** ni Twilio ni la Cloud API de Meta mandan
mensajes a grupos. `WHATSAPP_GRUPO_PRUEBA` y el `whatsappGrupo` de cada
estacionamiento tienen que ser **el número de una persona** (el encargado o un
celular del estacionamiento), no un grupo.

### Poner Twilio a andar

1. Crear cuenta en [twilio.com](https://www.twilio.com) (la de prueba alcanza).
2. Activar el **WhatsApp Sandbox**: Console → Messaging → Try it out → Send a
   WhatsApp message. Da un número (`+1 415 523 8886`) y un código.
3. Desde el celular que va a recibir los avisos, mandarle ese código por
   WhatsApp a ese número. Eso lo habilita como destinatario del sandbox.
4. Copiar el **Account SID** y el **Auth Token** del panel de Twilio.
5. Cargarlos:

```bash
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=+14155238886
```

Para producción hay que pedir un número propio aprobado por Meta a través de
Twilio y cambiar `TWILIO_WHATSAPP_FROM`. El sandbox sirve para probar, no para
clientes reales.

### A qué número se manda

```bash
WHATSAPP_GRUPO_PRUEBA=+54911...
```

Mientras se prueba, esta variable **pisa** el número de todos los
estacionamientos. En producción se deja **vacía** y cada estacionamiento recibe
el aviso en su propio grupo, que es para lo que existe la columna
`Parking.whatsappGrupo` (ya está en el modelo y se edita desde el panel).

**Si faltan credenciales, la reserva se confirma igual.** El envío devuelve
`PENDIENTE`, queda el registro en `NotificationLog` y el servidor loguea
exactamente qué falta configurar. Una notificación no puede tirar abajo una
reserva ya hecha.

### "Enviar a mi WhatsApp": la imagen del comprobante, no un texto

El botón del comprobante ya **no abre `wa.me`**. Llama a
`POST /reservations/comprobante/:token/enviar-whatsapp`, y el backend manda por
la API de WhatsApp (la misma integración del aviso al grupo) **la imagen del
comprobante** —la misma de la vista web, con el QR— como adjunto real, al
teléfono que el cliente cargó en la reserva (nunca a otro: el número no viene en
el pedido). El texto es solo un pie corto:

> ✅ ¡Reserva confirmada! Código **SN-XXXXXX**
> Mostrá esta imagen al entrar al estacionamiento.

Todo lo demás (estacionamiento, horarios, cliente, vehículo, montos) está en la
imagen. El mismo envío sale solo cuando se acredita la seña.

| Proveedor | Cómo viaja la imagen |
|---|---|
| `twilio` | `MediaUrl` = la URL del PNG. **Twilio la descarga desde sus servidores**, así que `PUBLIC_API_URL` tiene que ser pública: en producción lo es; en desarrollo, la del túnel de Cloudflare (ver *Probar la vuelta automática*). Si no lo es, el envío falla antes de llamar a Twilio con un motivo claro, en vez de mandar un link a localhost. |
| `cloud_api` | Se **sube** el PNG a Meta (`/media`) y se manda por id. No necesita URL pública. |
| `link` (sin credenciales) | No puede adjuntar nada: el botón avisa *"El envío por WhatsApp todavía no está configurado en este entorno"*. |

Con el sandbox de Twilio, **el teléfono del cliente también tiene que haberle
mandado el código `join …` al número del sandbox**; si no, Twilio acepta el
pedido pero el mensaje no llega. Eso desaparece con un número propio aprobado.

Lo que cambió en el aviso al grupo: ahora también lleva la imagen del
comprobante, con su texto de siempre como pie. Si la imagen no se puede
adjuntar, el aviso sale igual, solo con el texto, como antes.

**Lo que no se pudo probar:** un envío real, porque no hay credenciales de
Twilio ni de Meta cargadas. Probado: el pedido exacto a Twilio y a Meta (con
`fetch` simulado), el corte por URL no pública, el botón sin credenciales en el
navegador, y que la imagen se descarga por el túnel público (`200 image/png`,
141 KB).

---

## Seguridad y aislamiento entre estacionamientos

- Un `OWNER` o `STAFF` solo puede leer y modificar datos de **su** estacionamiento.
  Se valida **en cada endpoint del backend** (`filtroTenant` / `asegurarTenant` en
  `src/middleware/auth.js`), no ocultando botones.
- Pasar un `?parkingId=` ajeno no sirve: para los roles no-SUPERADMIN se ignora y
  se usa el del token.
- Un `OWNER` no puede bajarse la comisión ni crear usuarios `SUPERADMIN`.
- Contraseñas con bcrypt. Los refresh tokens se guardan **hasheados** y **rotan**
  en cada uso: si alguien roba uno y lo usa, se revocan todas las sesiones.
- El login responde lo mismo si el email no existe o si la clave está mal, y
  tarda lo mismo: no se filtra qué emails están registrados.
- `helmet`, CORS por lista blanca, y `express-rate-limit` más estricto en login y
  en la creación pública de reservas.
- El comprobante público se protege con un token de 32 bytes en base64url:
  imposible de enumerar.
- Acciones sensibles quedan en `AuditLog`.

Hay tests de integración que verifican esto contra la API real
(`backend/tests/integration/tenant.test.js`).

---

## API

Prefijo `/api/v1`. Documentación interactiva en **`/api/docs`** (Swagger UI) y
el JSON en `/api/openapi.json`.

La API es **independiente del frontend**: la app móvil que venga después la
consume igual, sin cambios.

**Público** (sin autenticación)

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/parkings` | Busca por cercanía, con precio y disponibilidad |
| `GET` | `/parkings/:idOSlug` | Detalle |
| `GET` | `/reservations/comprobante/:token/comprobante.png` | Comprobante como imagen (la que va por WhatsApp) |
| `POST` | `/parkings/:id/cotizar` | Precio y cupo sin crear nada |
| `POST` | `/onboarding/fotos` | Sube fotos del estacionamiento (multipart) |
| `POST` | `/onboarding/parkings` | Solicitud de alta de un estacionamiento |
| `POST` | `/reservations` | Crea la reserva (como invitado) |
| `GET` | `/reservations/comprobante/:token` | Comprobante |
| `GET` | `/reservations/comprobante/:token/qr.svg` | QR para imprimir |
| `POST` | `/reservations/comprobante/:token/enviar-email` | Reenvía por email |
| `POST` | `/reservations/comprobante/:token/enviar-whatsapp` | Manda la imagen del comprobante al WhatsApp del cliente |
| `GET` | `/payments/mercadopago/vuelta/:token` | La `back_url` de Mercado Pago: sincroniza el pago y redirige a `/pago/:token` |
| `GET` | `/reservations/comprobante/:token/pago` | Estado de la seña; si está aprobada, confirma la reserva |
| `POST` | `/reservations/comprobante/:token/pagar-sena` | Arma el checkout de la seña (botón "Pagar la seña"; también reintenta) |
| `POST` | `/payments/mercadopago/webhook` | Aviso de Mercado Pago (lo llama la pasarela, no un usuario) |
| `GET` | `/payments/estado` | Si hay credenciales de la pasarela y si son de prueba |
| `GET` | `/vehiculos/catalogo` | Marcas y modelos del catálogo, para el autocompletado del checkout |
| `GET` | `/vehiculos/clasificar?marca=&modelo=` | Tipo de vehículo detectado, o `null` si no está en el catálogo |

**Panel** (requiere `Authorization: Bearer <accessToken>`)

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/auth/login` · `/auth/refresh` · `/auth/logout` | Sesión |
| `GET` | `/admin/reservations` | Listado con búsqueda, filtros y paginación |
| `POST` | `/admin/reservations` | Alta manual |
| `POST` | `/admin/reservations/:id/:accion` | check-in · check-out · cancelar · no-show |
| `GET` | `/admin/reservations/buscar?q=` | Búsqueda rápida por código o patente |
| `GET` | `/admin/reservations/:id/whatsapp` | Mensaje + link para el grupo |
| `GET` | `/admin/reservations/resumen-dia` | Resumen del día en un solo mensaje |
| `GET` | `/admin/reservations/exportar.csv` | Exportación |
| `GET/POST/PATCH` | `/admin/parkings…` | Datos, fotos, campos extra, bloqueo de cupos |
| `GET/POST/PATCH/DELETE` | `/admin/rates` · `/admin/staff` | ABM |
| `GET` | `/admin/onboarding` | Solicitudes de alta (solo SUPERADMIN) |
| `GET` | `/admin/onboarding/pendientes` | Solo el número, para el badge del menú |
| `DELETE` | `/admin/parkings/:id/definitivo` | Eliminación permanente (pide el nombre exacto) |
| `POST` | `/admin/onboarding/:id/aprobar` · `/rechazar` | Revisión de una solicitud |
| `GET` | `/admin/reports/dashboard` · `/admin/reports/comisiones` | Reportes |
| `DELETE` | `/admin/reservations/:id` | Quita del panel una reserva terminada (borrado lógico; OWNER, STAFF, SUPERADMIN) |
| `DELETE` | `/admin/staff/:id/definitivo` | Elimina un usuario |
| `POST` | `/auth/cambiar-password` | Cambia la contraseña propia (pide la actual; cierra todas las sesiones) |
| `GET` | `/admin/reservations/nuevas` | Reservas confirmadas que el usuario todavía no vio (contador del menú) |
| `POST` | `/admin/reservations/vistas` | Las marca como vistas (lo llama la pantalla de Reservas) |
| `PATCH` | `/admin/reservations/:id/vehiculo` | Corrige el tipo de vehículo y ajusta lo que se paga en el lugar |
| `GET/POST/PATCH/DELETE` | `/admin/vehiculos-catalogo` | Catálogo de marca/modelo/tipo (solo SUPERADMIN) |

Todos los errores responden igual:

```json
{ "error": { "codigo": "SIN_CUPO", "mensaje": "No quedan lugares disponibles en ese horario..." } }
```

El `mensaje` ya viene redactado en español para mostrarle al usuario tal cual.

---

## Tests

```bash
npm test                        # todo
npm --prefix backend run test:unit         # sin base de datos
npm --prefix backend run test:integration  # contra la base real
```

**193 tests**, sobre lo que duele si se rompe:

- **Patentes argentinas** — formatos viejo, Mercosur y de moto; normalización.
- **Teléfonos** — las diez formas en que la gente escribe un número (`011 15 …`,
  `+54 9 11 …`, `15-…`, solo el abonado) y cómo terminan todas en el mismo E.164.
- **Escalones de precio** — que la media estadía cobre 4 horas y la completa 5,
  que las 12 h exactas caigan en la completa, que pasadas las 24 h el ciclo se
  reinicie y que dejar el auto más tiempo nunca salga más barato.
- **Capacidad** — que no se sobrevenda, incluido el caso de **5 pedidos
  simultáneos por el último lugar**: entra exactamente uno.
- **Aislamiento multi-tenant** — que un estacionamiento no pueda ver ni tocar los
  datos de otro, ni pasando ids a mano.
- **Alta por autogestión** — que una solicitud pendiente no aparezca en la
  búsqueda ni deje entrar al panel, que solo el SUPERADMIN pueda aprobarla, que
  rechazar no borre nada y que no se pueda dar de alta sin fotos.
- **Tarifas por tipo de vehículo** — que un estacionamiento cuya única tarifa
  está atada a "Auto" siga cotizando en la búsqueda genérica (era el bug que lo
  hacía invisible), sin volver a mostrarle el precio de moto a quien busca para
  un auto.
- **Cobro** — que el servicio se sume al subtotal y no se descuente, y que
  `comisión + neto === total` sin centavos perdidos.
- **La seña y Mercado Pago** — que sin seña acreditada no salga ni el
  comprobante ni el aviso al estacionamiento; que al acreditarse salgan los dos,
  juntos; que el mismo pago avisado dos veces **no los duplique**; que un pago
  rechazado deje reintentar en vez de cancelar la reserva; y que un aviso viejo
  no pueda dar de baja una seña que ya entró. Más la traducción de los estados
  de Mercado Pago, el reconocimiento de URLs que la pasarela no puede alcanzar
  (localhost, redes privadas) y los tres formatos de aviso del webhook.
- **Vuelta desde Mercado Pago** — que la vuelta siempre termine en SpotNear
  con la pista correcta, que un token raro no sirva para redirigir afuera, que
  el estado lo decida la pasarela y no la URL, y que la regla de la vuelta
  automática sea https.
- **Email y WhatsApp sin red** — lo que se le manda a Resend, Twilio y Meta: el
  adjunto en base64, el reintento con el remitente de prueba, la imagen como
  `MediaUrl` o subida por id, y el corte cuando Twilio no podría descargarla.
- **Los cinco casos del bug de tarifas** — 2 h, 6 h, 12 h, 20 h y 26 h con la
  hora a $7.500, y la seña del 20% sobre el precio de los escalones.
- **Catálogo de vehículos** — que "VW T-Cross" y "volkswagen tcross" sean lo
  mismo, que "Corolla Cross" no se confunda con "Corolla", que lo desconocido
  no se adivine, y que solo el SUPERADMIN lo edite.
- **Panel** — el contador de reservas nuevas (sube y vuelve a 0), la
  corrección del tipo de vehículo en el check-in (ajusta lo que se paga allá,
  no la seña) y el cambio de contraseña (pide la actual, cada uno la suya).
- **Eliminar reservas** — que solo se eliminen las terminadas, cada
  estacionamiento las suyas, y que Comisiones y el comprobante no cambien.
- **Horarios** — que cada uno de los tres modos valide lo suyo: que 24 h acepte
  cualquier hora, que el fijo maneje el cierre después de medianoche, y que el
  atado al evento no invente una hora de cierre aunque el JSON traiga una vieja.

Los de integración crean sus propios datos con un sufijo único y los borran al
terminar. Si una corrida se interrumpe, `npm run db:limpiar-pruebas` limpia lo
que haya quedado.

**Ningún test le pega a Mercado Pago.** `tests/setup.js` fuerza
`PAYMENT_PROVIDER=simulado`: sería lento, dependería de internet y de
credenciales, y le estaríamos probando el software a ellos. Lo que se prueba es
nuestra mitad —qué pasa cuando la seña entra—, que es donde puede romperse algo
que importe.

---

## Verificar que una aprobación se refleja al instante

Sin esperar ningún proceso en segundo plano ni reiniciar nada:

1. Registrá un estacionamiento desde `/registrar-estacionamiento`, con una
   dirección cerca del Movistar Arena.
2. Panel → **Solicitudes** → *Aprobar y publicar*.
3. Panel → **Tarifas**, elegilo en el selector y cargale una tarifa por hora.
4. Buscá "Movistar Arena" en la home: tiene que aparecer en la lista.

> ⚠️ **El paso 3 no es opcional.** Sin ninguna tarifa el estacionamiento no
> puede cotizar y la búsqueda lo saltea, aunque figure como publicado en el
> panel. El aviso está en la pantalla de tarifas y en el email de aprobación.
>
> Lo que **sí** cambió: antes también desaparecía si su única tarifa estaba
> atada a un tipo de vehículo (por ejemplo, solo "Auto"), porque la búsqueda
> genérica no pregunta el vehículo y ninguna tarifa le aplicaba. Eso está
> corregido y cubierto por tests.

---

## Decisiones que tomé

### El servicio se suma, no se descuenta

El ejemplo del pedido era explícito: subtotal 12.000 + servicio 1.200 = total
13.200. O sea que el estacionamiento cobra su tarifa **entera** y el cargo va
encima, como en la mayoría de las plataformas. Distinto del modelo anterior,
donde la comisión se sacaba del total. Cambió `calcularCobro()` en
`money.js`; `calcularComision()` quedó para las reservas viejas y los reportes
históricos.

### La sesión del panel se cierra a los 15 minutos

Solo en el panel: el sitio público no tiene sesión. Cuentan clics, teclas,
scroll, movimiento del mouse y toques; **no** cuenta tener la pestaña abierta,
ni que el cliente HTTP renueve el token solo, ni los pedidos automáticos (los
contadores de Reservas y Solicitudes que se refrescan cada minuto). Un minuto antes aparece un aviso con un botón para seguir
conectado, y ahí mover el mouse no alcanza: hay que apretarlo, para que nadie
pierda la sesión sin enterarse de que estuvo por perderla.

El cierre manual se propaga a las demás pestañas por `BroadcastChannel`, con
respaldo en el evento `storage` de `localStorage` para navegadores viejos.

### El "Ingresar" del header abre otra pestaña

El panel es otra aplicación. Si se abriera en la misma pestaña, el que estaba
buscando un lugar perdería la búsqueda. Los links públicos siguen navegando
normal.

### El header flota y se redondea al scrollear

A partir de **48px** de scroll, el header se despega de los bordes, se redondea
en píldora (`border-radius: 999px`), se vuelve translúcido con
`backdrop-filter: blur(14px)` y levanta una sombra. Al volver arriba, deshace
todo con la misma transición.

48px y no 100: alcanza para que el gesto se sienta intencional y no se dispare
con el rebote del scroll de iOS. El gris del fondo (`rgba(241, 246, 251, .78)`)
tira apenas al azul de marca en vez de ser un gris neutro, para que no choque al
lado del logo.

El listener de scroll es **pasivo** y lo único que hace es prender y apagar la
clase `.sn-header--flotante`; toda la animación la resuelve CSS. Los márgenes
crecen por breakpoint (16px en móvil, 32px desde 900px, y centrado al ancho
máximo desde 1280px) para que en una pantalla ancha no quede una barra
interminable pegada a los bordes.

Detalles que hubo que contemplar: el menú desplegable del móvil se redondea
junto con el header (si no, asoman las esquinas cuadradas debajo de la píldora),
el alto baja de 68 a 60px para que el óvalo no quede desproporcionado, hay un
`@supports` que opaca el fondo donde no haya `backdrop-filter` (si no, el
texto quedaría ilegible sobre el contenido que pasa por debajo), y con
`prefers-reduced-motion` no hay transición.

Se aplica a **todas las páginas públicas**, porque vive en el `Header` que usa
`LayoutPublico`: home, detalle, checkout, comprobante, registro y estáticas. La
pantalla de resultados no lo tiene porque no usa ese header (la reemplaza la
barra de búsqueda persistente), y el panel administrativo tampoco: tiene su
propia barra superior.


### El azul sale del logo, pero el de los botones es más oscuro

El círculo del logo es `#188FEB`. Muestreé el PNG píxel por píxel en vez de
sacarlo a ojo. Ese tono queda en **3,40:1** contra el blanco, y WCAG pide 4,5:1
para el texto de un botón, así que los botones usan `#1177C5` (4,70:1): el mismo
tono, un escalón más oscuro. El azul del logo queda para el logo y para
elementos gráficos, donde con 3:1 alcanza.

Todo sale de `--sn-marca` y `--sn-accion` en `frontend/src/styles/variables.css`.
Cambiar la marca es cambiar esas variables.

### Saqué los atajos de duración y el resumen del período

A pedido. La contrapartida a tener en cuenta: el `datetime-local` nativo se
dibuja con el formato del navegador, y en un Chrome configurado en inglés eso
es **mm/dd/aaaa**. El resumen que estaba debajo existía justamente para
desambiguar eso. Si alguna vez aparece una confusión de fechas, ahí está la
causa.

### El bug que renombraba reservas viejas

El peor bug que tuvo el sistema. Crear una reserva nueva cambiaba el nombre del
cliente de **todas las reservas anteriores hechas con el mismo teléfono**.

**Causa raíz: una escritura real e incorrecta en la base, no un problema
visual.** No fue un `UPDATE` sin `WHERE` —el `WHERE` apuntaba bien a una sola
fila— sino un error de diseño:

```js
// obtenerOCrearCliente, antes
const existente = await tx.customer.findFirst({ where: { telefono } });
if (existente) {
  return tx.customer.update({          // ← una sola fila, el WHERE está bien
    where: { id: existente.id },
    data: { nombre: cliente.nombre,    // ← pero le pisa el nombre
            apellido: cliente.apellido },
  });
}
```

El cliente se busca por teléfono y se reutiliza. Eso está bien: es el mismo
contacto. El problema es que **un teléfono lo comparten varias personas** —una
familia, una oficina, un playero que reserva para su cliente— y al reservar se
le pisaba el nombre al contacto compartido. Como las reservas mostraban el
nombre a través de la relación (`reserva.customer.nombre`) y **ninguna guardaba
a nombre de quién se había hecho**, todas las anteriores quedaban re-etiquetadas
de golpe.

Se agrava con el tiempo: cuantas más reservas acumula un teléfono, más filas se
re-etiquetan de una sola vez.

**El arreglo son dos cosas, y hacen falta las dos:**

1. **La reserva congela los datos del cliente** (`clienteNombre`,
   `clienteApellido`, `clienteEmail`). Un comprobante emitido es un documento de
   algo que ya pasó y no se re-escribe. Mismo patrón que ya se usaba para
   `parkingNombre` al eliminar un estacionamiento.
2. **Reservar ya no pisa el nombre del contacto.** Solo se rellena lo que
   estaba vacío: sumar un email que antes no había es información nueva;
   reemplazar un nombre existente es destruirla.

Hay un test de regresión (`tests/integration/cliente-congelado.test.js`) que
crea dos reservas con el mismo teléfono y nombres distintos, y verifica que la
primera siga diciendo lo que decía.

**Los datos se recuperaron.** El `NotificationLog` guarda el texto del mensaje
tal como se armó al crear cada reserva, y ese texto lleva la línea
`👤 Nombre Apellido` con el nombre correcto del momento. La migración
`20260929100000` lo extrae y lo escribe en la copia congelada. **Nueve reservas
habían quedado mal etiquetadas y las nueve se recuperaron** —entre ellas
"Cristhian Melo" y "Armando Mendoza", que aparecían como "Jose Antonio Parra
Garcia"—. No hizo falta avisarle a nadie.

Lo que sí se perdió: el nombre **en la fila de `Customer`** de las reservas más
viejas, que quedó con el del último que reservó. No importa para nada que se
muestre, porque todo lo que se ve sale de la copia congelada; solo afecta al
contacto como agenda.

### El "bug de tarifas" no estaba en el motor: estaba en la barra de resultados

Reporte: con 2 horas, resultados y checkout mostraban la media estadía ($30.000
con la hora a $7.500) en vez de $15.000.

**El motor de precios estaba bien.** Se probaron los cinco casos contra la API
local y contra la de Render, y los tres escalones daban lo correcto (`< 4 h`,
`[4, 12)`, `[12, 24)` y reinicio a las 24 h). Tampoco había lógica duplicada:
búsqueda, checkout y carga manual del panel llaman todos a `calcularPrecio()`.

**La causa real:** la barra de horario de la pantalla de **resultados**
guardaba el cambio solo en el campo y no lo aplicaba hasta apretar la lupa. Si
el cliente cambiaba la salida ahí (por ejemplo, de las 4 h que trae el Hero por
defecto a 2 h), la barra mostraba 2 horas pero las tarjetas seguían cotizadas
con 4 (media estadía), y "Reservar" llevaba al checkout ese rango viejo. Lo que
se veía y lo que se cotizaba estaban desincronizados.

**El arreglo:** cambiar el horario, el destino o la modalidad en esa barra
relanza la búsqueda sola (con una pausa de 0,6 s, porque el campo de fecha y
hora dispara un cambio por cada parte que se edita). Si el rango no es válido,
lo avisa en el momento. Probado en el navegador: cambiar la salida a 2 h pasa
la URL a 2 h y el precio a $15.000 + seña, sin tocar la lupa.

### Cupos en la tarjeta: "15 lugares · 12 disponibles en tu horario"

La tarjeta de resultados muestra la capacidad total y lo que queda libre **para
el horario buscado**, con la misma cuenta que impide la sobreventa al confirmar
(descuenta las reservas que se superponen y los cupos bloqueados). Se escribe
"en tu horario" y no "ahora" porque la cuenta es para el rango que eligió el
cliente, que puede ser la semana que viene. En el mapa, el mismo dato va en el
tooltip de cada precio.

Un estacionamiento sin lugar en ese horario **ya no desaparece**: la pantalla
de resultados pide `soloDisponibles=false`, y aparece al final de la lista con
"Sin disponibilidad en este horario" y el botón Reservar deshabilitado. Antes
se ocultaba sin explicación.

### Tipo de vehículo: catálogo propio de marca y modelo

No existe una API pública y gratuita para saber el tipo por patente en
Argentina, así que SpotNear tiene **su propio catálogo**
(`VehicleModelCatalog`): **188 modelos** del mercado argentino (94 autos,
52 SUV, 15 camionetas, 10 utilitarios y 17 motos). Van en **migraciones** y no
en el seed, para que también estén en producción: 106 en la carga inicial y 82
de Mercedes-Benz y BMW en `20261005100000_catalogo_mercedes_bmw` (Clase
A/B/C/E/S, CLA, CLS, GLA/GLB/GLC/GLE/GLS, Clase G, Clase X → camioneta, Clase
V y Citan → utilitario; BMW Serie 1 a 8, M2–M5, Z4, X1–X7, iX y las motos G,
F, R y S). Como la búsqueda es por prefijo, además de la línea van las
denominaciones con número como se escriben en la calle: "C 200", "320" (así
"320i" o "C200 Avantgarde" se reconocen).

- En el checkout, **marca, modelo y color son obligatorios** (en el formulario
  y en la API). Al escribir marca y modelo se consulta el catálogo y, si hay
  coincidencia, se preselecciona el tipo y el precio de la derecha se
  recalcula solo, con el aviso "Lo detectamos por Renault Duster. Si no es
  así, cambialo".
- La comparación ignora mayúsculas, tildes, guiones y espacios ("VW T-Cross" =
  "volkswagen tcross"), entiende alias de marca (VW, Chevy, Mercedes) y tolera
  la versión detrás del modelo ("Hilux SRV 4x4"). Si dos modelos empiezan
  igual, gana el más específico: "Corolla Cross" es SUV y "Corolla", auto.
- **Si no lo encuentra, el tipo queda sin elegir.** No se asume "Auto" (antes
  venía preseleccionado), porque equivocarse para abajo le cobra de menos al
  estacionamiento. El resumen muestra "Tarifa de referencia" hasta que se
  elige.
- El tipo **no se bloquea**: el cliente lo puede cambiar, y el precio se
  recalcula igual. Una detección nueva solo ocurre si cambia la marca o el
  modelo; una elección manual se respeta.
- El SUPERADMIN amplía el catálogo desde **Panel → Catálogo de vehículos**
  (alta, edición y baja; avisa si un modelo ya existe escrito de otra forma).
- **Corrección en el check-in:** en el detalle de una reserva confirmada o en
  curso, el playero puede corregir el tipo si lo que ve no coincide. El ajuste
  es **automático y solo sobre lo que se paga en el lugar**: se recotiza con el
  tipo nuevo y la diferencia se suma o se resta; la seña ya cobrada no cambia.
  El panel muestra cuánto cobrar de más ("Cobrale $1.000 más en el lugar").

### Contador de reservas nuevas en el menú

Criterio elegido: **reservas confirmadas después de la última vez que el
usuario abrió la lista de Reservas**, y que todavía están por atenderse
(confirmadas o en curso). Cada usuario tiene su propio "visto"
(`User.reservasVistasEn`): lo que vio el dueño sigue siendo nuevo para el
playero. Las que el usuario cargó él mismo desde el panel no cuentan.

Se mide contra el momento de la **confirmación** (`pagadaEn`), no el de
creación: una reserva con Mercado Pago nace pendiente y se confirma después, y
para el estacionamiento es nueva cuando se confirma. Se descartó la
alternativa "pendientes de check-in de hoy" porque no responde la pregunta
"¿entró algo desde la última vez que miré?". Se refresca igual que el de
Solicitudes (cada minuto y al volver a la pestaña) y desaparece en 0. Lo ven
OWNER y STAFF; el SUPERADMIN no tiene un estacionamiento propio.

### Panel: menú contraíble y "Mi cuenta"

- **Menú lateral contraíble** (escritorio): el botón de arriba lo deja en 72 px
  con solo los íconos; el nombre de cada sección queda como tooltip y el
  contador se monta sobre el ícono. La preferencia se guarda en el navegador
  (`localStorage`). En el celular el menú sigue siendo el panel desplegable.
- **Mi cuenta** (los tres roles): en el menú y tocando el nombre arriba a la
  derecha. Por ahora solo cambia la contraseña: pide la actual, la nueva (8
  caracteres como mínimo, la misma regla del resto del sistema, y distinta de
  la actual) y la confirmación. El usuario sale del token, nunca del
  formulario, así que cada uno cambia solo la suya. Al cambiarla se cierran
  todas las sesiones y se vuelve a ingresar con la nueva.

### Hero en el celular

Mismo contenido, otro orden: sin la foto (empujaba el buscador fuera de la
primera pantalla), título de 28 px en vez de 40, pestañas en una sola línea y
la tarjeta con menos relleno lateral y más aire entre campos, siguiendo el
hero mobile de SpotHero. Verificado en 360, 375 y 430 px, sin scroll
horizontal.

### Por qué el cierre por inactividad andaba en localhost y no en Render

**Causa raíz:** los 15 minutos se contaban con un `setTimeout` en la memoria
de la pestaña, y nada más. Probándolo en localhost (pestaña al frente, mirando
el reloj) funciona. En el uso real del sitio publicado ese temporizador se
pierde:

- el navegador **congela o descarta las pestañas en segundo plano** (ahorro de
  energía/memoria de Chrome y Edge): un temporizador congelado no dispara;
- la notebook **se suspende** con el panel abierto;
- al volver, la pestaña **se recarga** y la app arrancaba una cuenta nueva de
  15 minutos con los tokens que seguían en `localStorage`: la sesión quedaba
  abierta indefinidamente.

Además, el scroll del panel ocurre dentro del contenedor de contenido y el
evento `scroll` no burbujea hasta `window`, donde se escuchaba: scrollear el
panel no contaba como actividad. Se revisaron también las otras hipótesis y se
descartaron: no hay ningún chequeo de `NODE_ENV` ni de modo desarrollo en este
mecanismo, la minificación no lo toca, la sesión no usa cookies (los tokens van
en `localStorage`), y los pedidos automáticos nunca reiniciaron el contador:
solo lo hacen los eventos del DOM.

**La solución** (`frontend/src/hooks/useSesionPanel.js`):

- La hora de la **última interacción se guarda** en `localStorage`
  (`spotnear.ultimaActividad`) y se compara contra el reloj real cada 5 s, al
  volver a la pestaña y al recuperar el foco. Si pasaron 15 minutos —con la
  pestaña congelada, la compu dormida o lo que sea—, se cierra apenas el código
  vuelve a correr.
- **Al cargar la app** (`AuthContext`), si la sesión guardada lleva más de 15
  minutos sin uso, se cierra antes de mostrar nada y el login dice "Tu sesión se
  cerró por inactividad".
- Los eventos se escuchan en `document` en fase de captura, así el scroll de
  cualquier contenedor cuenta.
- El cierre local ya no espera la respuesta del servidor: con el plan gratis el
  backend puede tardar un minuto en despertar. Se limpia la sesión en el acto y
  el refresh token se revoca en segundo plano.
- Como la marca es compartida, usar el panel en una pestaña cuenta como
  actividad para todas.

Probado en el navegador: aviso a los 14 minutos, cierre a los 15 y cierre al
recargar una sesión vieja, con el refresh token revocado en el servidor (401 al
intentar reusarlo).

### Pantallas de laptop (1366x768)

La escala tipográfica era la misma en todos los anchos (texto base de 15 px,
secundario de 13 px). En un monitor grande se lee bien; en una notebook de
1366x768, que físicamente es chica, se veía diminuto. Hay un breakpoint nuevo
en `styles/variables.css` para **1024–1599 px** —cubre 1280, 1366 y 1440, y
también 1536/1920 con el escalado de Windows al 125–150 %—, que sube un escalón
el texto de lectura (base 16 px, secundario 14 px, chico 13 px), ensancha un
poco el contenedor (1240 px) y el menú del panel (264 px). Como todo el CSS usa
esos tokens, el ajuste llega a las pantallas públicas y al panel sin tocarlas
una por una. En el celular y en 1600 px o más, nada cambia.

### El horario en la tarjeta de resultados

Se muestra junto a los otros tags (cubierto, servicios), con un reloj:
"Abierto las 24 horas", "Abre 06:00 · Cierra 22:00" o "Abre 18:00 · Cierra al
finalizar el evento". En los modos con hora, es la del **día buscado** (cada
día puede tener la suya); si ese día cierra, dice "Cerrado ese día". También va
en el tooltip del marcador del mapa. Sale de `utils/horarios.js` →
`leyendaHorario`, la misma lógica de los tres modos que ya usaba la ficha.

### Columnas descuadradas en las tablas del panel

En *Reservas*, las celdas de Ingreso y Salida tenían `display: flex` puesto
directamente en el `<td>`. Eso las saca del modelo de tabla: el navegador las
apilaba en una sola columna y todas las siguientes (Estado, Monto) quedaban
corridas respecto de su título. Lo mismo pasaba con la celda de acciones de
*Equipo*. El flex pasó a un `<div>` dentro de la celda, como ya estaba en
Cliente y Vehículo. Verificado midiendo el borde izquierdo de cada encabezado
contra su celda: coinciden al píxel en las nueve columnas.

### El precio de la tarjeta dice "Desde"

El monto de la tarjeta de resultados es el de la tarifa de **auto**. Si en el
checkout el cliente elige SUV, camioneta o moto, puede cambiar. Por eso ahora
dice "Desde $36.000" con la aclaración "Precio para auto · varía según el
vehículo" debajo. La burbuja del mapa sigue mostrando solo el número: es un
marcador y no entra más texto.

### Cupos: "seguía diciendo 15 disponibles" (dos bases distintas)

**Causa real:** el backend local (`npm run dev`) usa la base de **Neon**
(`DATABASE_URL` de `backend/.env`) y el de Render usa **su propia base**. La
reserva pagada de prueba (`SN-PRRR39`, Bilbo, 06/10 19:00 a 07/10 00:30) se
hizo contra el backend local, y la búsqueda de la captura era la del sitio de
Render: esa reserva ahí no existe. El cálculo de cupos estaba bien y se
verificó: para ese horario la API local responde `libres: 14` de 15. Cuentan
las reservas PENDIENTE (durante los 30 minutos que dura el pago), CONFIRMADA y
EN_CURSO; no hay caché ni en el backend ni en el frontend.

Lo que sí se mejoró: el tablero del panel mostraba solo "libres **ahora**", que
una reserva para mañana no cambia. Ahora, debajo, dice **"Próximos 7 días: N
reservas · en el momento más cargado (fecha y hora) quedan X de Y lugares
libres"**, calculado con el mismo criterio que la búsqueda
(`picoDeOcupacion` en `services/availability.js`). Una reserva recién pagada
se ve ahí aunque empiece mañana.

Si querés que local y Render vean lo mismo, apuntá los dos a la misma base (la
`DATABASE_URL` de Render en tu `.env`, o al revés). Ojo: entonces lo que
pruebes en local aparece en producción.

### El modo de prueba del cierre por inactividad

Para verificar el cierre sin esperar 15 minutos, en la consola del navegador
(F12) del panel:

```js
localStorage.setItem('spotnear.inactividadMinutos', '2')
```

y recargá. La sesión se cierra a los 2 minutos sin tocar nada (aviso a los
60 s). Solo puede **acortar** el tiempo (de 1 a 14 minutos): un valor más alto
se ignora. Para volver a los 15: `localStorage.removeItem('spotnear.inactividadMinutos')`.

Verificado además con el **build de producción** (minificado, sin modo
estricto) contra el backend local: sesión abierta en *Reservas*, pestaña en
segundo plano, contadores refrescándose cada minuto. La marca de actividad no
se movió (los pedidos automáticos no cuentan), el aviso apareció y la sesión se
cerró sola. En el sitio de Render se verificó el cierre al recargar una sesión
vieja.

Si probaste con una pestaña del panel que estaba abierta **antes** de un
deploy, esa pestaña sigue corriendo el código viejo hasta que se recarga:
recargá antes de probar.

### Si los pagos de prueba fallan con «Algo salió mal»

El 04/10/2026 todos los pagos de prueba empezaron a fallar con "Algo salió
mal... No pudimos procesar tu pago". **No era Render ni el código**: se
reprodujo igual en local, y creando el pago **directo contra la API de Mercado
Pago**, sin pasar por SpotNear, la respuesta fue `HTTP 500 internal_error` con
cualquier tarjeta (Master, Visa, Amex), en efectivo y con cualquier email. Las
preferencias se crean bien, con las URLs correctas de Render. Lo que falla es la
creación del pago del lado de Mercado Pago para esas credenciales.

Para revisarlo sin adivinar:

```bash
cd backend && npm run mp:diagnostico
```

Revisa, sin imprimir las credenciales: que sean del mismo tipo, de qué cuenta
son, si se puede crear una preferencia y si se puede crear un pago de prueba con
la tarjeta `APRO`. Si el último paso falla con 500, es de la cuenta o de la
aplicación de Mercado Pago:

1. Cargá las **credenciales de prueba actuales** de Mercado Pago Developers →
   *Tus integraciones* → *SpotNear* → *Credenciales de prueba*. Hoy el panel
   las da con formato `APP_USR-…` (son de una cuenta vendedora de prueba que
   crea solo; el diagnóstico lo reconoce y dice "credenciales de PRUEBA"). Las
   `TEST-…` de la cuenta real son el formato viejo, que fue el que dejó de
   andar. Cargalas en `backend/.env` y en Render, y volvé a correr el
   diagnóstico.
2. Si sigue fallando, usá cuentas de prueba: en la aplicación, *Cuentas de
   prueba* → creá una **vendedora** y una **compradora**; con la vendedora
   (en incógnito) creá una aplicación y usá sus **credenciales de producción**
   (`APP_USR-…`) en el backend; pagá iniciando sesión con la compradora.
3. Si nada de eso alcanza, reclamo al soporte de Mercado Pago con el
   `x-request-id` que imprime el diagnóstico.

**«Una de las partes con la que intentás hacer el pago es de prueba»** (05/10):
quiere decir que el vendedor y el comprador son de mundos distintos. Se
diagnosticó creando una preferencia desde el backend de Render: el vendedor era
`3293676301`, **tu cuenta real** (Render seguía con las credenciales `TEST-`
viejas), y el comprador era una **cuenta de prueba**. En local, con las
`APP_USR-` de la cuenta vendedora de prueba (`3723109745`) y la compradora de
prueba, el pago se aprobó (reservas `SN-J63CWE` y `SN-PRRR39`). No era el
código: hay que cargar en Render las mismas credenciales que en local.

**Con las credenciales `APP_USR-` de prueba, el comprador también tiene que
ser de prueba.** Probado el 04/10/2026: pagando como invitado con la tarjeta
`APRO`, Mercado Pago corta con "Algo salió mal... Una de las partes con la
que intentás hacer el pago es de prueba". Y la API de Pagos directa responde
"Unauthorized use of live credentials" (por eso `mp:diagnostico` saltea ese
paso con estas credenciales). La compra de prueba se hace así:

1. Mercado Pago Developers → *Tus integraciones* → la aplicación → *Cuentas de
   prueba* → **+ Crear cuenta de prueba** → país Argentina, tipo
   **Comprador**, con algo de dinero ficticio.
2. En SpotNear, reservá con cualquier email que no sea el de esa cuenta y tocá
   *Pagar la seña*.
3. En el checkout de Mercado Pago elegí **Ingresar con mi cuenta** e iniciá
   sesión con el usuario y la contraseña de la cuenta compradora (si pide un
   código, es el *Código de verificación* que figura en la tabla de cuentas de
   prueba). Mejor en una ventana de incógnito, para no mezclar con tu sesión
   real.
4. Pagá con el dinero de la cuenta o con la tarjeta `5031 7557 3453 0604`,
   titular `APRO`. Mercado Pago vuelve solo a SpotNear y aparece el
   comprobante.

### Antes de pagar, nunca se dice "tu lugar está apartado"

La pantalla "Falta pagar la seña" decía *"Tu lugar está apartado, pero..."*
antes de que el cliente pagara nada. Ahora dice *"Para reservar tu lugar, pagá
la seña ahora"*. Con el mismo criterio se corrigieron el aviso del checkout, la
aclaración de la seña y la nota de "pago en proceso": recién con la seña
acreditada el lugar está reservado, y así lo dicen todos los textos.

Por dentro, el cupo sí se le guarda 30 minutos a quien está pagando (para que
nadie se lo gane en el medio), pero eso es un detalle técnico, no una promesa
al cliente.

### Las reservas sin seña no aparecen en el panel

La reserva nace en `PENDIENTE` cuando el cliente confirma, y eso está bien: es
lo que permite asociar el pago de Mercado Pago (`external_reference`) y apartar
el lugar mientras paga. El problema era que **ninguna vista del panel la
distinguía**: se listaba con las demás, sumaba en "Facturado" y ofrecía
**check-in**, porque las transiciones permitían `PENDIENTE → EN_CURSO`.

Ahora `PENDIENTE` significa, en todo el sistema, "la seña todavía no entró":

- **Listado de reservas** (dueño y SUPERADMIN): la vista por defecto —"Todas
  (con seña pagada)"— las excluye, y los totales también. Se ven eligiendo
  "Esperando la seña (sin pagar)" en el filtro de estado, con esa etiqueta, que
  no se confunde con un cliente que va a llegar.
- **Dashboard, resumen del día para el grupo, búsqueda rápida del playero y
  reportes de comisiones**: no las cuentan.
- **Acciones**: sobre una reserva sin seña solo se puede **cancelar**. Check-in,
  confirmar y no-show devuelven 409 con un mensaje claro, y el panel no muestra
  esos botones. El estado del pago tampoco se puede cambiar a mano: lo decide
  Mercado Pago. Se confirma sola cuando la seña se acredita.

Al hacerlo apareció un bug propio: el total "Facturado" del listado pisaba el
filtro de estado al agregar el suyo, y sumaba reservas que la tabla no
mostraba. Corregido.

### El mapa de resultados quedaba corrido

Reproducido midiendo en píxeles dónde caían los marcadores. Dos causas:

1. **`fitBounds` con un margen chico.** Acerca el zoom hasta que los puntos
   tocan el borde. Con el destino y un solo estacionamiento eso es una
   diagonal: el destino terminaba en una esquina y el estacionamiento en la
   opuesta, pegado al borde (medido: a 50 px del borde en un mapa de 730 px).
   Ahora el margen es un 20% del tamaño del mapa y el zoom tiene tope (16):
   quedan los dos en la zona central.
2. **La firma que decide cuándo reencuadrar era solo la lista de ids de los
   resultados.** Buscar otro lugar que devolviera los mismos estacionamientos
   —con uno solo cargado, pasa siempre— movía el marcador de destino pero no
   el mapa. Ahora la firma incluye el destino. Probado: cambiar de Movistar
   Arena a Parque Centenario recentra.

No era una coordenada fija: el mapa sí se calculaba con los resultados.

### "Movistar Arena" viene precargado en el buscador

Es solo un valor inicial: se borra y se cambia como cualquier texto. Viene ya
resuelto con las coordenadas de `lugares.js` (Humboldt 450), así que buscar sin
tocarlo es lo mismo que elegirlo de la lista de sugerencias. Puede diferir en
unos metros de la coordenada que devuelve Google Places para el mismo lugar;
con un radio de 2,5 km los resultados son los mismos.

### El formulario del checkout no ofrece el autocompletado del navegador

`autoComplete="off"` en el `<form>` y en cada campo. No afecta al buscador de
direcciones de Google Places, que es otro componente en otra pantalla. Aviso:
Chrome a veces ignora `off` en campos que reconoce como nombre o teléfono y
muestra igual sus perfiles guardados; es una decisión del navegador y no hay un
valor estándar que la evite siempre.

### El resumen del checkout se simplificó

Se sacaron "A pagar ahora" / "A pagar en el estacionamiento" (repetían el
desglose), los dos mensajes de cancelación y cambio sin costo, y el link
"Cambiar" del período, que llevaba a la vista de detalle. El período quedó
puramente informativo. La vista de detalle sigue existiendo como ruta, pero ya
nada del flujo lleva a ella.

### El buscador del hero: cuál pestaña está prendida se decide en una lista

El hero tuvo tres configuraciones en dos semanas —las dos pestañas activas,
después solo "Eventos", ahora solo "Por hora / Diario"— y en ninguna se borró
código. Hoy:

- **"Por hora / Diario"** es la principal y arranca activa: buscador de
  direcciones con Google Places, e **Ingreso y Salida en dos casillas
  separadas**, una al lado de la otra.
- **"Mensual"** se ve, en gris, con `cursor: not-allowed` y `aria-disabled`. No
  reacciona al clic.

Detrás de "Mensual" sigue entero el formulario que se armó para eventos —el
desplegable de sedes con Movistar Arena, el campo de fecha, la ventana horaria
de 19 a 1— sin tocar. Por eso su id interno sigue siendo `EVENTOS`: "Mensual"
es la etiqueta que ve el cliente, no lo que hay adentro.

**Todo se maneja desde una lista**, en `components/busqueda/TarjetaBusqueda.jsx`:

```js
const PESTANAS = [
  { id: 'HORARIO', etiqueta: textos.busqueda.porHora },
  { id: 'EVENTOS', etiqueta: textos.busqueda.mensual, deshabilitada: true },
];
```

Sacar o poner `deshabilitada` es el cambio completo. Cuál arranca activa sale de
esa misma lista (la primera que no esté pausada), así que prender y apagar
pestañas no pide tocar nada más. Después de la tercera vuelta, que esto fuera
una línea valió la pena.

**Las sedes de eventos salen de otra lista**, en `components/busqueda/lugares.js`:

```js
const SEDES_HABILITADAS = ['movistar-arena'];
```

Para sumar una sede se agrega su `id` a ese array. Los ids ya cargados con
coordenadas reales son: `luna-park`, `estadio-monumental`, `la-bombonera`,
`teatro-colon`, `la-rural`, `hipodromo-palermo`, `estadio-obras` y
`centro-costa-salguero`.

El **período por defecto es de 4 horas** (`DURACION_POR_DEFECTO_HORAS` en
`hooks/useBusqueda.js`), contadas desde la próxima media hora. No es un número
cualquiera: 4 h es el piso de la media estadía, así que el precio que ve el que
llega a la home ya es el del escalón que más se usa, y no uno que se le va a
mover apenas elija horario.

La barra de búsqueda de la **pantalla de resultados** conserva las dos
modalidades a propósito: ahí el usuario está corrigiendo una búsqueda que ya
hizo, no entrando al producto. La pausa es sobre la puerta de entrada.

### La tarjeta de resultados ya no lleva a ninguna parte

Se sacó el link "Detalles" y también los links de la foto y del nombre: de la
tarjeta se reserva y punto. Eran tres puertas al mismo lugar para una decisión
—este estacionamiento o el de al lado— que ya se toma con lo que está a la
vista: foto, distancia, calificación, servicios y precio.

La pantalla de detalle **no se borró**: sigue en `/estacionamiento/:slug` y se
usa desde el checkout, en el link "Cambiar" del período.

### El tag "Cubierto" era un default, no un dato

Parking Thames 350 aparecía como techado sin serlo. La tarjeta leía bien el
campo: el problema era de dónde salía el valor.

```prisma
cubierto Boolean @default(true)   // ← y los tres formularios arrancaban tildados
```

Todo estacionamiento nacía "cubierto" sin que nadie lo hubiera decidido. En la
tarjeta eso se convertía en una promesa al cliente —hay techo— que no salía de
ninguna parte.

El default pasó a `false`, en la columna y en los tres formularios de alta
(registro por autogestión, alta desde el panel, "Mi estacionamiento"). Un
atributo que se le promete al cliente tiene que ser una decisión del dueño, no
lo que venía puesto.

De los datos guardados se corrigió **solo Parking Thames 350**, que es el único
que sabemos que estaba mal (migración `20260929110000`). El resto se dejó como
está: no hay forma de distinguir a quien tildó el casillero de quien lo dejó
como venía, y reescribir datos de otros por las dudas es peor que el problema.
**Si algún estacionamiento sí es techado, hay que marcarlo en el panel.**

Los servicios (cámaras, vigilancia, lavado) nunca tuvieron este problema:
arrancan en `[]`, así que lo que está ahí lo puso alguien.

### Las dos inconsistencias de datos del panel

Eran dos problemas distintos con una sola causa raíz.

**El filtro de estacionamientos eliminados no llegaba a las relaciones.** La
extensión de Prisma inyecta `eliminadoEn: null` en las lecturas de `Parking`,
pero solo en las de **primer nivel** (`prisma.parking.findMany`). Cuando el
reporte de Comisiones pide `prisma.reservation.findMany({ include: { parking } })`,
ese `parking` anidado **no pasa por la extensión**: viene completo, como si el
estacionamiento siguiera activo. Por eso seguían apareciendo Humboldt, Padilla,
Palermo y Arena Park después de eliminarlos.

El dato en sí era legítimo —esas reservas se conservan a propósito, son el
historial contable— así que la corrección fue **de presentación**: cada fila usa
ahora la copia guardada al eliminar (`parkingNombre`) y se marca con "Ya no está
en la plataforma". Lo mismo en el listado de reservas, con un "Eliminado" al
lado del nombre.

**Los 29 contra 13 eran correctos, pero nadie lo podía saber.** Son dos números
de cosas distintas: "Reservas" mostraba el total histórico sin filtrar y
"Comisiones" solo el período elegido, descartando además las canceladas.
Verificado contra la base: 29 totales, 23 del mes, 20 del mes en estados que
cuentan. Ninguno venía de caché ni de datos mockeados.

La corrección fue etiquetar: "31 reservas en total (todo el historial)" en una
pantalla, y "Solo las reservas del período elegido, sin contar las canceladas"
en la otra.

### El precio no cambió al pasar a la seña, solo cambió de nombre

Cuando llegó el modelo de seña, el motor de cálculo ya hacía exactamente lo que
hacía falta: la comisión se sumaba al subtotal y `montoNeto === subtotal`, o sea
el estacionamiento ya recibía el 100% de su tarifa. Lo único que había que
cambiar era **qué se cobra** (solo la seña, no el total) y **cómo se lo nombra**.

Por eso las columnas de la base siguen llamándose `montoComision` y
`comisionPorcentaje`: renombrarlas habría obligado a migrar datos para no ganar
nada, y en las pantallas internas "comisión" es la palabra correcta. La
traducción a "seña" pasa en la capa de presentación, que es donde importa.

### Saqué el sistema de eventos completo

Existía una pestaña "Eventos" en el buscador, una tabla `Venue` de estadios, una
tabla `Event` de recitales, tarifas tipo `EVENTO` y pantallas de panel para
administrar las dos cosas. Se eliminó todo a pedido. Lo que se fue, en detalle:

- **Base:** las tablas `Event` y `Venue`, las columnas `Rate.eventId` y
  `Reservation.eventId`, y el valor `EVENTO` del enum `RateType`.
- **Backend:** los módulos `events/` y `venues/` con sus endpoints públicos
  (`/api/v1/events`, `/api/v1/venues`) y de panel (`/api/v1/admin/events`,
  `/api/v1/admin/venues`), y toda la rama de precio por evento en
  `pricing.js`.
- **Frontend:** la pestaña del hero, el desplegable de sitios, el campo "Evento
  al que vas" del formulario de reserva, la columna "Evento" de la tabla de
  tarifas, la fila del comprobante, las pantallas `Eventos` y
  `Sitios de eventos` del panel con sus entradas de menú y rutas, y los textos
  que las acompañaban.
- **Seed:** los siete sitios, los recitales de ejemplo y las tarifas especiales.

Las tarifas `EVENTO` que existían en la base se **borraron** en la migración
`20260926120000_sin_eventos_y_suv`: eran precios atados a recitales concretos que
ya no tienen a qué referirse. Las reservas históricas no se tocaron; solo
perdieron la referencia al evento.

**Lo que no se fue:** el modo de horario `FIN_EVENTO` ("cerramos cuando termina
el evento"). Es una forma de declarar el horario de cierre de un
estacionamiento, no depende de la tabla `Event` y sigue siendo válida: hay
playas que efectivamente cierran cuando se vacía el estadio de al lado.

### "Camioneta / SUV" se partió en dos

Eran un solo tipo de vehículo con la etiqueta `Camioneta / SUV`. Ahora son
`CAMIONETA` y `SUV`, independientes, en el enum del backend, el selector de
tarifas, el formulario de reserva, los tipos aceptados del alta y los filtros de
la búsqueda pública.

**Cómo se migraron las tarifas que ya existían** (migración
`20260926130000_suv_backfill_e_idempotencia`):

- A todo estacionamiento que aceptaba `CAMIONETA` se le agregó también `SUV` a
  `tiposVehiculo`. Quien aceptaba camionetas acepta SUV: es el criterio que no
  le saca visibilidad a nadie sin avisarle.
- **Cada tarifa de `CAMIONETA` se duplicó como una tarifa de `SUV` al mismo
  precio** (los ids de las copias arrancan con `suvmig`, así se pueden encontrar
  después). Alternativa descartada: reasignar la tarifa a uno de los dos tipos,
  que habría dejado al otro sin precio y al estacionamiento fuera de las
  búsquedas de ese vehículo.
- Los `Vehicle.tipo` históricos **no se tocaron**: una camioneta que ya estacionó
  siguió siendo una camioneta. Reclasificarla a posteriori sería inventar un dato
  que nadie cargó.

El ícono es el mismo para los dos: dibujar dos siluetas casi iguales no ayuda a
distinguirlas.

### El primer clic en "Confirmar reserva" fallaba, y no era la conexión

El síntoma era un cartel de "revisá tu conexión" en el primer intento y un éxito
inmediato en el segundo. **La causa real: el pedido nunca llegaba al servidor.**

Cómo se descartó el resto: un `fetch` directo desde la página siempre respondía
bien; el pooler de Neon no era el culpable, porque después de seis minutos de
inactividad el primer pedido seguía funcionando; y en la base **no había ni un
par de reservas duplicadas**, lo que descarta que el pedido se procesara y se
perdiera la respuesta. Apuntando un `fetch` a un puerto muerto el error se
reprodujo exacto: `TypeError: Failed to fetch`, sin `AbortError`.

En desarrollo lo provocaba `node --watch` reiniciando el backend; en producción
lo va a provocar un host dormido despertándose. Pero el defecto de verdad estaba
en el cliente: `api.js` trataba **cualquier** falla de transporte como problema
de conexión del usuario y se rendía en el primer intento.

La corrección tiene dos partes, y ninguna es un reintento a ciegas:

1. En `frontend/src/services/api.js`, se reintenta **solo** el caso
   `TypeError: Failed to fetch`, que por definición significa que el pedido no
   se procesó. Un `AbortError` (timeout) **no** se reintenta: ahí el servidor
   pudo haber hecho el trabajo y repetirlo duplicaría la reserva.
2. Para que el reintento sea seguro igual, la creación de reservas lleva una
   **clave de idempotencia** (`Reservation.idempotencyKey`, con índice único). El
   checkout genera una por visita, así todos los reintentos —los automáticos y
   los que haga el usuario tocando el botón otra vez— cuentan como el mismo
   pedido. Si dos llegan a la vez, la carrera se resuelve por el índice único
   (`P2002`) y se devuelve la reserva que ya existe.

### El comprobante por WhatsApp va como imagen, no como texto

Antes el cliente recibía un bloque largo con todos los datos sueltos y una
docena de emojis. En el celular eso se lee mal y se pierde lo único que importa
al llegar: el código y el QR.

El problema es que un link `wa.me` **no puede adjuntar archivos**: solo arma
texto prellenado. Y el PNG que ya existía se dibujaba en un canvas del
navegador, así que del lado del servidor no existía.

Cómo quedó:

1. `backend/src/services/comprobante-imagen.js` arma el comprobante como SVG y
   lo rasteriza con `sharp`. Se eligió SVG sobre puppeteer o un canvas nativo
   porque no necesita un Chromium de 300 MB ni compilar bindings.
2. `GET /api/v1/reservations/comprobante/:token/comprobante.png` lo sirve en una
   URL pública, protegida por el mismo token no adivinable que el comprobante
   web, y cacheada 24 h (una reserva confirmada no cambia).
3. El mensaje pasó de ~1.400 caracteres a ~490: código, dónde, cuándo, total y
   el link a la imagen. El resto de los datos ya están en la imagen.

**Los dos proveedores lo resuelven distinto, y quien llama no se entera:**

| Proveedor | Qué hace con la imagen |
|---|---|
| `wa.me` | No puede adjuntar: el botón del cliente avisa que el envío no está configurado |
| `twilio` | `MediaUrl`: Twilio descarga el PNG de la URL pública |
| `cloud_api` (Meta) | Sube el PNG a `/media` y lo manda por id, con el pie de texto |

`enviarWhatsApp({ destino, texto, imagenUrl, imagenPng })` es la única firma que
conoce el resto del sistema. Ver *"Enviar a mi WhatsApp"* más arriba.

El email lleva el mismo PNG como adjunto.

### El comprobante es una sola imagen

Antes había dos dibujos del comprobante: `backend/src/services/comprobante-imagen.js`
(SVG rasterizado con `sharp`, para WhatsApp y el adjunto del email) y un canvas
en el navegador para "Guardar imagen". Ahora hay **uno solo**, el del backend
(`GET /reservations/comprobante/:token/comprobante.png`): "Guardar imagen" lo
descarga, el email lo muestra embebido en el cuerpo (`cid:`) y además adjunto,
y WhatsApp manda ese mismo archivo. Lo que el cliente guarda, lo que recibe por
mail y lo que muestra en la entrada es exactamente lo mismo.

El email ya no es una tabla de texto con los datos: el cuerpo es la imagen del
comprobante, con los botones "Ver mi comprobante" y "Cómo llegar" debajo. Para
que salga de verdad hace falta `RESEND_API_KEY` (ver *Emails*); sin ella el
botón "Enviar por email" avisa que el envío no está configurado.

"Enviar a mi WhatsApp" se sacó de la pantalla del comprobante hasta que
WhatsApp esté activo (ver *Qué falta para activar WhatsApp*): un botón que no
manda nada es peor que no tenerlo. El endpoint sigue en el backend.

### Eliminar un estacionamiento: qué se borra y qué no

"Dar de baja" (`activo = false`) despublica y se revierte. **"Eliminar
definitivamente"** es otra cosa y está al final del formulario de edición, en
una Zona de peligro que solo ve el SUPERADMIN. Pide escribir el nombre exacto,
y el backend lo vuelve a validar: saltearse el modal no alcanza.

El obstáculo: **todas** las relaciones apuntan a `Parking` con
`ON DELETE CASCADE`, las reservas incluidas. Un `delete` se llevaría
el historial contable.

**La decisión sobre las reservas históricas: no se borran nunca.** Son el
respaldo de lo que se cobró y de lo que se liquidó. Por eso hay dos caminos:

| Caso | Qué pasa con la fila |
|---|---|
| Sin reservas | Se borra de verdad. La cascada limpia tarifas, fotos, campos extra y cupos bloqueados |
| Con reservas | Queda como ancla de esas filas, marcada con `eliminadoEn`, y se esconde de todas las consultas |

En el segundo caso, **antes** de marcarla se copia el nombre y la dirección en
cada reserva (`Reservation.parkingNombre` y `parkingDireccion`), así el
comprobante y el historial se siguen leyendo solos. Las tarifas, fotos, campos
extra y cupos bloqueados se borran en los dos casos: sin el estacionamiento no
describen nada.

Se descartó cambiar la relación a `SetNull` con `parkingId` nullable: eso
debilita las veinte consultas que hoy asumen que toda reserva tiene
estacionamiento, a cambio de ahorrar una columna.

**Que desaparezca de verdad** no se logró filtrando en cada consulta, sino con
una extensión del cliente de Prisma (`backend/src/config/prisma.js`) que inyecta
`eliminadoEn: null` en toda lectura de `Parking`. Son veinte lugares que leen esa
tabla y alcanza con que uno se olvide para que el estacionamiento reaparezca en
una búsqueda. Las escrituras no pasan por el filtro: el único código que toca
una fila eliminada es el que la eliminó.

**Los usuarios** OWNER y STAFF que dependían de él quedan `activo = false`, sin
`parkingId` y con los refresh tokens revocados. No se borran: un usuario
borrado se lleva su rastro de la auditoría.

### El contador de reservas contaba todo el historial

El badge de cada estacionamiento mostraba `_count.reservas` **sin filtro**:
todas las reservas que ese estacionamiento tuvo en su vida, canceladas
incluidas. Por eso no coincidía con ningún otro número de la interfaz y solo
crecía. Ahora cuenta las vigentes (`PENDIENTE`, `CONFIRMADA`, `EN_CURSO`), que
es lo que se espera leer al lado de "120 lugares".

El otro defecto era que se cargaba una sola vez al montar la pantalla.
`useRefrescoAutomatico` lo vuelve a pedir al volver el foco a la pestaña y cada
minuto, saltándose las consultas mientras la pestaña está oculta.

### El badge de solicitudes

Círculo azul al lado de "Solicitudes", solo para el SUPERADMIN, con las que
están en `PENDIENTE_APROBACION`. **Si es 0 no se muestra**: un cero en el menú
es ruido, no información. Se alimenta de `GET /admin/onboarding/pendientes`, que
devuelve solo el número: traerse el listado completo con las fotos y los dueños
de cada solicitud para mostrar un dígito sería tirar todo eso a la basura en
cada consulta.

Se refresca con el mismo hook que el contador de reservas, y además al cambiar
de pantalla: así cuando el SUPERADMIN aprueba o rechaza una y vuelve, el número
ya bajó. Polling simple; no hay websockets en el proyecto y para esto no los
justifica.

### El reintento de red se quedaba corto

El bug del primer clic volvió a aparecer, ahora en el login del panel. **Es la
misma causa raíz** que la del checkout —el pedido no llega al servidor y el
cliente lo trata como problema de conexión del usuario— y el fix **sí** había
llegado a esta pantalla: vive en `api.js`, que es por donde pasan todas las
llamadas, no en cada formulario.

Lo que falló fue el dimensionamiento. Midiendo un reinicio de `node --watch`
contra esta base, la ventana en la que el servidor no responde es de **1.659 ms**.
El presupuesto de reintentos era de 1.200 ms (dos reintentos, 400 y 800 ms): se
agotaba justo antes de que el servidor volviera. De ahí el síntoma de "a veces
entra y a veces no".

Ahora son cuatro reintentos con esperas de 300, 700, 1.500 y 2.500 ms: ~5 s de
presupuesto, que cubre un reinicio y un hosting despertando. Y si
`navigator.onLine` dice que no hay red, no se reintenta nada: ahí el mensaje de
"revisá tu conexión" sí corresponde y se muestra al instante.

**Un detalle que cuesta diagnosticar:** un rechazo de CORS produce exactamente
el mismo `TypeError: Failed to fetch` que un servidor caído, y el navegador no
deja distinguirlos. Si el frontend arranca en un puerto que no está en
`CORS_ORIGINS` (pasa cuando el 5173 está ocupado y Vite salta al 5174), **todas**
las llamadas fallan con "no pudimos conectarnos" después de agotar los 5 s. Si
aparece ese error de punta a punta, mirar el puerto antes que la red.

### Se fue el estado de pago "pendiente en el lugar"

`PaymentStatus` tenía `PENDIENTE_EN_LUGAR` como valor **por defecto**, del
modelo anterior en que el cliente pagaba al llegar. Por eso el comprobante
seguía imprimiendo la leyenda al lado del total aunque el checkout ya dijera
otra cosa.

Se eliminó el valor del enum y el default pasó a `PENDIENTE`. Las reservas que
estaban en ese estado migraron a `PENDIENTE`: nunca se registró un cobro para
ellas, así que siguen pendientes. **No se inventó un `PAGADO` donde no hubo
plata.** El comprobante ahora muestra "✓ Pagado" o "Pago pendiente" según
corresponda, en las cuatro superficies: web, PNG descargable, imagen de WhatsApp
y email.

### El número de teléfono de ejemplo

Había un número personal real usado como placeholder y como dato de prueba en
**42 lugares de 15 archivos** (placeholders de inputs, seed, fixtures, tests de
normalización, `.env`, `.env.example`, OpenAPI, comentarios y el schema), más dos
filas en la base. Todo quedó en `11 1234 5678` / `+54 9 11 1234-5678`.

Uno de esos lugares merece atención: `VITE_WHATSAPP_SOPORTE` en
`frontend/.env`. **Es el WhatsApp de soporte que se publica en el bundle del
frontend**, o sea visible para cualquiera que abra el sitio. Quedó apuntando al
número genérico; si se quiere un soporte real hay que poner ahí un número de la
empresa, no uno personal.

### El alta por autogestión no vive en `parkings.admin.routes.js`

Ese router entero pasa por `requiereAuth`, y quien se registra todavía no tiene
cuenta. Por eso es un módulo aparte (`onboarding`) con su propio límite de tasa,
más estricto que el general: es el endpoint público más caro de la API, porque
crea un usuario y un estacionamiento sin autenticación.

### Rechazar no borra

Una solicitud rechazada queda en la base con su motivo. Hace falta para poder
revisarla después, revertir un error y no perder el histórico de quién se quiso
sumar.

Cosas que el pedido no definía y resolví con criterio, para que quede constancia:

**Logo sobre fondo claro.** El isotipo (el círculo azul con el pin) es igual en
las dos variantes; lo que cambia es el color del wordmark, que tiene que
contrastar con el fondo. `logo_spotnear.png` lo trae blanco, para el footer, el
panel y el comprobante; `logo_spotnear_black.png` lo trae oscuro, para el header
público y el login.

**El interruptor "mostrar precio total".** En SpotHero alterna entre mostrar el
precio con o sin cargos de servicio. Acá no hay cargos extra —el precio que ve el
cliente es el final—, así que lo usé para alternar entre el **total de la estadía**
y el **precio por hora** del estacionamiento, que es la comparación que realmente
sirve.

**Fechas en los selectores.** Uso inputs nativos `datetime-local` porque en el
celular abren el selector del sistema, que es el que la gente ya sabe usar. El
navegador los dibuja en el formato de su idioma (en inglés, mm/dd/aaaa). Como eso
no se puede forzar, debajo del selector se repite el período en formato argentino
("Sábado 26/09 19:00 → 00:30"). Todo lo demás que renderiza la app —tarjetas,
comprobante, tablas, mensajes de WhatsApp— usa dd/mm/aaaa y 24 horas.

**Comprobante en PDF e imagen.** El PDF sale por el diálogo de impresión del
navegador ("Guardar como PDF") con una hoja de estilos de impresión dedicada: sin
dependencias y funciona en todos lados. La imagen se dibuja en un `<canvas>` a
mano (`utils/comprobanteImagen.js`), también sin librerías, y sale un ticket
branded de 720 px listo para guardar en el carrete.

**Íconos.** SVG propios en un solo archivo (`components/ui/Iconos.jsx`) en lugar
de una librería: pesan poco y heredan el color del texto.

**Reintentos de base.** Los Postgres serverless (Neon, Supabase) suspenden la base
cuando no se usa, y la primera consulta después de un rato falla en vez de esperar
el arranque. El cliente Prisma reintenta los errores de conexión transitorios
(`P1001`, `P1002`, `P1017`, `P2024`) con espera creciente. Sin eso, el primero que
entra a la web después de un rato de calma se come un error.

**Latencia.** Si usás Neon o Supabase, elegí una región cercana (`sa-east-1`,
São Paulo). Con la base en Estados Unidos cada consulta se va a ~500 ms y una
reserva —que corre en una transacción serializable— puede tardar 10 segundos.

**Duplicación de validaciones.** Patentes y teléfonos se validan en el frontend y
en el backend. Es a propósito: el servidor es la única fuente de verdad, pero el
usuario merece que le avisen mientras escribe, sin esperar una ida y vuelta. Si
cambia una regla, hay que tocar los dos lados (`backend/src/utils/` y
`frontend/src/utils/validaciones.js`).

**Textos legales.** Términos y Privacidad están escritos y describen honestamente
cómo funciona el producto hoy, pero **son un borrador**: antes de operar
comercialmente los tiene que revisar un abogado, sobre todo respecto de la Ley
25.326 de Protección de Datos Personales.

---

## Qué quedó pendiente o simulado

**Simulado (funciona, pero no envía de verdad)**

- **WhatsApp.** La v1 genera links `wa.me` con el mensaje ya escrito: alguien lo
  abre y lo manda. Es lo que hoy se hace a mano, pero con los datos correctos y
  el formato siempre igual. La capa de envío ya es un adaptador
  (`services/notifications/whatsapp.js`): para pasar a envío automático con la
  **WhatsApp Business Cloud API** hay que cargar `WHATSAPP_PROVIDER=cloud_api`
  más las credenciales de Meta. El código del proveedor ya está escrito.
- **Email.** Usa Nodemailer. Si no hay credenciales SMTP en el `.env`, no rompe:
  loguea el mail en consola y lo registra como `SIMULADO` en `NotificationLog`.
  Cargando `SMTP_HOST`, `SMTP_USER` y `SMTP_PASS` empieza a enviar de verdad.

**Andando con credenciales de prueba**

- **Pago online con Mercado Pago (Checkout Pro).** Está implementado completo:
  creación de la preferencia, webhook con validación de firma, consulta directa
  del estado, pantalla de pago con los cuatro casos, reintento, y la reserva que
  no se confirma hasta que la seña se acredita. Ya está cargado el access token de
  prueba de la aplicación **SpotNear** y se cobró una seña real en el sandbox,
  de punta a punta. Para producción falta activar las credenciales productivas
  en el panel de Mercado Pago y cambiarlas en el `.env`. Ver
  [Pasarela de pago](#pasarela-de-pago-mercado-pago-checkout-pro).

**Fuera de alcance, con el diseño preparado**

- **App móvil.** Por eso la API es autónoma y está documentada en OpenAPI.
- **Reservas mensuales completas.** La pestaña "Mensual" del hero está pausada
  (se ve en gris y no se puede entrar). El backend sigue cotizando la modalidad
  `MENSUAL` y la barra de resultados la ofrece, pero falta el flujo de
  facturación recurrente. Para reactivar la pestaña alcanza con sacarle
  `deshabilitada` a su entrada en `PESTANAS`.
- **Checkout embebido (Payment Bricks).** Hoy el cliente sale al checkout
  hospedado de Mercado Pago y vuelve. Pagar sin salir del sitio es una mejora
  posible: el contrato de `services/payments/` no cambia, solo el proveedor.
- **Facturación electrónica (AFIP/ARCA).**

**Cosas que conviene resolver antes de producción**

- **Subida de fotos.** Hoy se cargan por URL desde el panel. Falta subida de
  archivos (S3, Cloudinary o similar).
- **Reseñas reales.** Las calificaciones vienen del seed. El modelo tiene
  `calificacion` y `cantidadResenas`, pero no hay flujo para que el cliente puntúe.
- **Recuperar contraseña.** No está el flujo de "olvidé mi contraseña"; hoy el
  OWNER o el SUPERADMIN la resetean desde el panel.
- **Edición de horario de una reserva ya creada.** Cambiar el rango exige
  revalidar cupo y recalcular precio; por ahora se cancela y se carga de nuevo.
- **Revisión legal** de Términos y Política de privacidad.

---

## Licencia

Software propietario de **ColdevIA**. Todos los derechos reservados.
