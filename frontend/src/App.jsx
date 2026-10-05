/**
 * Raíz de la aplicación: proveedores y rutas.
 *
 * Las pantallas del panel se cargan con lazy: quien entra a reservar no tiene
 * por qué descargar el código del administrador.
 */
import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { ProveedorMapas } from './components/mapas/ProveedorMapas.jsx';
import { Cargando } from './components/ui/Estado.jsx';
import AvisoServidor from './components/layout/AvisoServidor.jsx';

import LayoutPublico from './layouts/LayoutPublico.jsx';
import Home from './pages/Home.jsx';
import Resultados from './pages/Resultados.jsx';
import DetalleParking from './pages/DetalleParking.jsx';
import Checkout from './pages/Checkout.jsx';
import Comprobante from './pages/Comprobante.jsx';
import Pago from './pages/Pago.jsx';
import RegistrarEstacionamiento from './pages/RegistrarEstacionamiento.jsx';
import { SobreNosotros, Terminos, Privacidad, NoEncontrado } from './pages/Estaticas.jsx';

/* ── Panel (carga diferida) ── */
const LayoutAdmin = lazy(() => import('./layouts/LayoutAdmin.jsx'));
const Login = lazy(() => import('./pages/admin/Login.jsx'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard.jsx'));
const Reservas = lazy(() => import('./pages/admin/Reservas.jsx'));
const DetalleReserva = lazy(() => import('./pages/admin/DetalleReserva.jsx'));
const NuevaReserva = lazy(() => import('./pages/admin/NuevaReserva.jsx'));
const MiEstacionamiento = lazy(() => import('./pages/admin/MiEstacionamiento.jsx'));
const Estacionamientos = lazy(() => import('./pages/admin/Estacionamientos.jsx'));
const Solicitudes = lazy(() => import('./pages/admin/Solicitudes.jsx'));
const Tarifas = lazy(() => import('./pages/admin/Tarifas.jsx'));
const Equipo = lazy(() => import('./pages/admin/Equipo.jsx'));
const Comisiones = lazy(() => import('./pages/admin/Comisiones.jsx'));
const MiCuenta = lazy(() => import('./pages/admin/MiCuenta.jsx'));
const CatalogoVehiculos = lazy(() => import('./pages/admin/CatalogoVehiculos.jsx'));

const cargando = <Cargando />;

const router = createBrowserRouter([
  /* ───────────── Público ───────────── */
  {
    element: <LayoutPublico />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/estacionamiento/:slug', element: <DetalleParking /> },
      { path: '/reservar/:slug', element: <Checkout /> },
      // El pago va antes del comprobante en el flujo: es donde vuelve el
      // cliente desde la pasarela y donde se espera la acreditación de la seña.
      { path: '/pago/:token', element: <Pago /> },
      { path: '/comprobante/:token', element: <Comprobante /> },
      { path: '/registrar-estacionamiento', element: <RegistrarEstacionamiento /> },
      { path: '/sobre-nosotros', element: <SobreNosotros /> },
      { path: '/terminos', element: <Terminos /> },
      { path: '/privacidad', element: <Privacidad /> },
      { path: '*', element: <NoEncontrado /> },
    ],
  },
  {
    // Los resultados ocupan la pantalla completa: sin footer y con su propio scroll.
    element: <LayoutPublico sinFooter sinHeader />,
    children: [{ path: '/buscar', element: <Resultados /> }],
  },

  /* ───────────── Panel ───────────── */
  {
    path: '/panel/ingresar',
    element: (
      <Suspense fallback={cargando}>
        <Login />
      </Suspense>
    ),
  },
  {
    path: '/panel',
    element: (
      <Suspense fallback={cargando}>
        <LayoutAdmin />
      </Suspense>
    ),
    children: [
      { index: true, element: <Suspense fallback={cargando}><Dashboard /></Suspense> },
      { path: 'reservas', element: <Suspense fallback={cargando}><Reservas /></Suspense> },
      { path: 'reservas/nueva', element: <Suspense fallback={cargando}><NuevaReserva /></Suspense> },
      { path: 'reservas/:id', element: <Suspense fallback={cargando}><DetalleReserva /></Suspense> },
      { path: 'mi-estacionamiento', element: <Suspense fallback={cargando}><MiEstacionamiento /></Suspense> },
      { path: 'estacionamientos', element: <Suspense fallback={cargando}><Estacionamientos /></Suspense> },
      { path: 'solicitudes', element: <Suspense fallback={cargando}><Solicitudes /></Suspense> },
      { path: 'tarifas', element: <Suspense fallback={cargando}><Tarifas /></Suspense> },
      { path: 'equipo', element: <Suspense fallback={cargando}><Equipo /></Suspense> },
      { path: 'comisiones', element: <Suspense fallback={cargando}><Comisiones /></Suspense> },
      { path: 'cuenta', element: <Suspense fallback={cargando}><MiCuenta /></Suspense> },
      { path: 'catalogo-vehiculos', element: <Suspense fallback={cargando}><CatalogoVehiculos /></Suspense> },
    ],
  },
]);

export function App() {
  return (
    <ProveedorMapas>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
          <AvisoServidor />
        </ToastProvider>
      </AuthProvider>
    </ProveedorMapas>
  );
}

export default App;
