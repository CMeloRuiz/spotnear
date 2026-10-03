# SpotNear · Frontend

Web de SpotNear. React 18 + Vite + **CSS puro**.

> La guía completa de instalación está en el [README de la raíz](../README.md).
> Acá va solo lo específico del frontend.

---

## Arrancar

```bash
cp .env.example .env     # completá VITE_API_URL y, si tenés, la key de Google Maps
npm install
npm run dev              # http://localhost:5173
```

El backend tiene que estar corriendo en `http://localhost:4000`.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción en `dist/` |
| `npm run preview` | Sirve el build para probarlo |
| `npm run lint` | ESLint |

---

## Cómo está organizado

```
src/
├── styles/
│   ├── variables.css   TODO el sistema de diseño: colores, tipografía,
│   │                   espaciado, sombras. Cambiar algo acá se propaga
│   │                   a toda la app.
│   ├── reset.css       Base pareja entre navegadores
│   └── global.css      Botones, campos, tarjetas, badges, tablas
│
├── i18n/textos.js      TODOS los textos de la interfaz, en un solo lugar
│
├── components/
│   ├── ui/             Campo, Iconos, Estado, Modal, Badge, Interruptor,
│   │                   SubirFotos (arrastrar y soltar + miniaturas)
│   ├── layout/         Header, Footer, Logo
│   ├── busqueda/       Buscador de direcciones, selector de sitios de
│   │                   eventos (SelectorSitio) y selector de período
│   ├── resultados/     Tarjeta de estacionamiento, filtros, mapa
│   ├── mapas/          Carga de Google Maps (una sola vez, en la raíz)
│   └── admin/          Tabla de reservas, gráfico, búsqueda rápida
│
├── pages/              Públicas (incluye RegistrarEstacionamiento),
│                       y pages/admin/ para el panel
├── layouts/            LayoutPublico · LayoutAdmin (rutas protegidas por rol)
├── services/
│   ├── api.js          Cliente HTTP: tokens, renovación automática, errores
│   └── spotnear.service.js   Una función por caso de uso
├── context/            AuthContext · ToastContext
├── hooks/              usePedido, useBusqueda, useAccionesReserva…
└── utils/              formato, validaciones, imagen del comprobante
```

---

## Convenciones

**CSS puro, sin frameworks.** Cada componente tiene su `.css` al lado del `.jsx`.
Lo que se repite en más de dos pantallas va a `styles/global.css`. Las clases
llevan prefijo `sn-` y siguen BEM: `.sn-tarjeta-parking__nombre`,
`.sn-boton--primario`.

⚠️ **Si una clase se usa tanto en el sitio público como en el panel, tiene que
estar en `global.css`.** El panel se carga como chunk aparte (lazy), así que una
clase definida en el CSS de un componente público no llega hasta allá. Por eso
`.sn-modos` (el selector de modo de horario) vive en `global.css` y no en
`RegistrarEstacionamiento.css`: lo usan el formulario público y el panel.

**Nada de valores sueltos.** Siempre variables:

```css
/* Bien */    padding: var(--sn-e4);  color: var(--sn-tinta);
/* Mal  */    padding: 16px;          color: #0f172a;
```

**Textos siempre desde `i18n/textos.js`.** Nada de strings sueltos en el JSX: así
internacionalizar después es agregar otro objeto, no salir a buscar por todos lados.

**Español de Argentina, con voseo.** "Reservá", "Ingresá", "Estacioná".

**Datos: siempre a través de `services/`.** Los componentes no arman URLs ni
llaman a `fetch`.

---

## Cambiar la identidad visual

Casi todo sale de `src/styles/variables.css`:

```css
--sn-marca: #188feb;              /* azul del círculo del logo */
--sn-marca-fuerte: #1177c5;      /* un escalón más oscuro, apto para texto encima */
--sn-accion: var(--sn-marca-fuerte);  /* botones principales */
--sn-tinta: #0f172a;             /* títulos y fondos oscuros */
```

⚠️ **Por qué `--sn-accion` no es `--sn-marca`.** El azul del logo da 3,40:1
contra el blanco y WCAG pide 4,5:1 para el texto de un botón. El tono fuerte da
4,70:1. Si cambiás la marca, mantené esa separación: el color del logo para
elementos gráficos, el fuerte para cualquier cosa con texto blanco encima.

Los assets están en `public/assets/`:

| Archivo | Dónde se usa |
|---|---|
| `logo_spotnear.png` | Fondos oscuros: footer, panel, comprobante |
| `logo_spotnear_black.png` | Fondos claros: header público, login |
| `hero.jpg` | Imagen principal de la home |
| `favicon.svg` · `icono-512.svg` | Ícono de la pestaña y de la app |
| `parkings/*.svg` | Fotos placeholder de los estacionamientos |

---

## Google Maps

Se carga una sola vez desde `components/mapas/ProveedorMapas.jsx`, montado en la
raíz de la app. Vive ahí y no dentro del mapa porque el buscador de direcciones de
la home también necesita la librería Places.

**La app funciona sin API key.** Sin ella (o si Google falla):

- El mapa de resultados cae a una vista alternativa propia que ubica las burbujas
  de precio proyectando lat/lng (`MapaResultados.jsx`).
- El buscador de direcciones usa la lista de lugares y barrios de Buenos Aires de
  `components/busqueda/lugares.js`.

Los pasos para obtener y restringir la key están en el
[README de la raíz](../README.md#google-maps-cómo-obtener-y-restringir-la-api-key).

---

## Accesibilidad

Lo que ya está y conviene no romper:

- Foco visible en todo lo interactivo, y nunca `outline: none` sin reemplazo.
- Formularios con `<label>` asociado, `aria-invalid` y `aria-describedby`: el
  lector de pantalla anuncia el error al enfocar el campo.
- El buscador de direcciones y la búsqueda rápida son comboboxes ARIA completos:
  flechas, Enter y Escape.
- Los modales atrapan el foco, cierran con Escape y lo devuelven al cerrarse.
- El gráfico del dashboard tiene una **tabla equivalente** para lectores de
  pantalla: la información nunca depende solo del color o de la forma.
- Se respeta `prefers-reduced-motion`.
