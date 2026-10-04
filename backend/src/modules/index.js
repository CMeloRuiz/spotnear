/**
 * Router principal de la API: /api/v1
 *
 * Público  → lo consume la web y, más adelante, la app móvil sin autenticación.
 * Privado  → panel administrativo, siempre con JWT y aislado por estacionamiento.
 */
import { Router } from 'express';
import env from '../config/env.js';
import prisma from '../config/prisma.js';
import { asyncHandler } from '../middleware/error.js';
import {
  pagoOnlineHabilitado,
  pagoSimulado,
  pasarelaLista,
  proveedorDePago,
  requierePagoPrevio,
} from '../services/payments/index.js';
import { hayVueltaAutomatica } from '../services/payments/mercadopago.js';
import { envioAutomatico } from '../services/notifications/whatsapp.js';

import authRoutes from './auth/auth.routes.js';
import parkingsPublicRoutes from './parkings/parkings.public.routes.js';
import parkingsAdminRoutes from './parkings/parkings.admin.routes.js';
import reservationsPublicRoutes from './reservations/reservations.public.routes.js';
import reservationsAdminRoutes from './reservations/reservations.admin.routes.js';
import { routerPublico as onboardingPublicRoutes, routerAdmin as onboardingAdminRoutes } from './onboarding/onboarding.routes.js';
import ratesRoutes from './rates/rates.routes.js';
import staffRoutes from './staff/staff.routes.js';
import reportsRoutes from './reports/reports.routes.js';
import paymentsRoutes from './payments/payments.routes.js';
import {
  routerPublico as vehiculosPublicRoutes,
  routerAdmin as vehiculosAdminRoutes,
} from './vehiculos/vehiculos.routes.js';

const router = Router();

/**
 * GET /api/v1/health
 * Chequeo de vida: incluye el estado real de la base.
 */
router.get(
  '/health',
  asyncHandler(async (req, res) => {
    let base = 'ok';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      base = `error: ${error.message}`;
    }

    res.json({
      servicio: 'spotnear-api',
      version: 'v1',
      entorno: env.NODE_ENV,
      zonaHoraria: env.TZ,
      base,
      hora: new Date().toISOString(),
    });
  }),
);

/**
 * GET /api/v1/config
 * Configuración que el frontend necesita conocer del servidor.
 */
router.get('/config', (req, res) => {
  res.json({
    moneda: env.MONEDA,
    zonaHoraria: env.TZ,
    comisionDefault: env.COMISION_DEFAULT_PORCENTAJE,
    pagoOnline: pagoOnlineHabilitado(),
    pagoSimulado: pagoSimulado(),
    // Todo lo que el checkout necesita saber de la pasarela. `disponible` en
    // false es lo que hace que el cliente vea "el pago en línea no está
    // disponible" en vez de un error después de cargar todos sus datos.
    pago: {
      proveedor: proveedorDePago(),
      disponible: pasarelaLista(),
      simulado: pagoSimulado(),
      // true = la reserva se confirma recién con la seña acreditada.
      cobroPrevio: requierePagoPrevio(),
      // ¿Mercado Pago puede devolver al cliente solo al terminar de pagar?
      // Necesita una URL de vuelta https (la API o la web): con http la
      // rechaza. Sin vuelta automática, el checkout se abre en otra pestaña y
      // la de SpotNear se queda esperando la acreditación (ver pages/Pago.jsx).
      vueltaAutomatica: requierePagoPrevio() && hayVueltaAutomatica(),
    },
    whatsapp: {
      modo: env.whatsappTwilioHabilitado ? 'twilio' : env.whatsappCloudHabilitado ? 'cloud_api' : 'link',
      // true = "Enviar a mi WhatsApp" manda la imagen del comprobante por la API.
      automatico: envioAutomatico(),
    },
    email: { configurado: env.mailHabilitado },
  });
});

// ─────────────────────── Público ───────────────────────
router.use('/auth', authRoutes);
router.use('/parkings', parkingsPublicRoutes);
router.use('/reservations', reservationsPublicRoutes);
// El webhook de la pasarela es público a propósito: lo llama Mercado Pago, no
// un usuario con sesión. Su seguridad está en la firma y en que el estado se
// vuelve a leer contra la API (ver payments.routes.js).
router.use('/payments', paymentsRoutes);
router.use('/onboarding', onboardingPublicRoutes);
// Catálogo marca/modelo → tipo de vehículo, para el checkout.
router.use('/vehiculos', vehiculosPublicRoutes);

// ─────────────────────── Panel (requiere JWT) ───────────────────────
router.use('/admin/parkings', parkingsAdminRoutes);
router.use('/admin/reservations', reservationsAdminRoutes);
router.use('/admin/onboarding', onboardingAdminRoutes);
router.use('/admin/rates', ratesRoutes);
router.use('/admin/staff', staffRoutes);
router.use('/admin/reports', reportsRoutes);
router.use('/admin/vehiculos-catalogo', vehiculosAdminRoutes);

export default router;
