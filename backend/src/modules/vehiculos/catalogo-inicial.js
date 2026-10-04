/**
 * Catálogo inicial de marca/modelo → tipo de vehículo, del mercado argentino.
 *
 * Es propio de SpotNear y se mantiene a mano: no depende de ninguna API
 * externa (no existe una pública y gratuita en Argentina). Estos datos entran
 * a la base por la migración 20261004110000_catalogo_de_vehiculos, así están
 * también en producción, donde el seed no corre. Después se amplía desde el
 * panel del SUPERADMIN (Catálogo de vehículos), sin tocar código.
 *
 * Criterio de clasificación, el mismo que usan las playas para cobrar:
 *   · AUTO        → sedanes, hatchbacks y compactos.
 *   · SUV         → SUV y crossovers, aunque sean chicos (T-Cross, 2008).
 *   · CAMIONETA   → pick-ups (Hilux, Amarok, Ranger, Toro, Strada).
 *   · UTILITARIO  → furgones y furgonetas (Kangoo, Partner, Sprinter).
 *   · MOTO        → motos.
 */
export const CATALOGO_INICIAL = [
  // ── Autos ──
  ['Chevrolet', 'Onix', 'AUTO'],
  ['Chevrolet', 'Prisma', 'AUTO'],
  ['Chevrolet', 'Cruze', 'AUTO'],
  ['Chevrolet', 'Corsa', 'AUTO'],
  ['Citroën', 'C3', 'AUTO'],
  ['Citroën', 'C4 Lounge', 'AUTO'],
  ['Fiat', 'Cronos', 'AUTO'],
  ['Fiat', 'Argo', 'AUTO'],
  ['Fiat', 'Mobi', 'AUTO'],
  ['Fiat', 'Uno', 'AUTO'],
  ['Fiat', 'Palio', 'AUTO'],
  ['Fiat', 'Siena', 'AUTO'],
  ['Ford', 'Ka', 'AUTO'],
  ['Ford', 'Fiesta', 'AUTO'],
  ['Ford', 'Focus', 'AUTO'],
  ['Honda', 'Civic', 'AUTO'],
  ['Honda', 'City', 'AUTO'],
  ['Honda', 'Fit', 'AUTO'],
  ['Hyundai', 'HB20', 'AUTO'],
  ['Nissan', 'Versa', 'AUTO'],
  ['Nissan', 'March', 'AUTO'],
  ['Nissan', 'Sentra', 'AUTO'],
  ['Peugeot', '208', 'AUTO'],
  ['Peugeot', '308', 'AUTO'],
  ['Peugeot', '408', 'AUTO'],
  ['Renault', 'Sandero', 'AUTO'],
  ['Renault', 'Logan', 'AUTO'],
  ['Renault', 'Kwid', 'AUTO'],
  ['Renault', 'Clio', 'AUTO'],
  ['Renault', 'Fluence', 'AUTO'],
  ['Toyota', 'Corolla', 'AUTO'],
  ['Toyota', 'Etios', 'AUTO'],
  ['Toyota', 'Yaris', 'AUTO'],
  ['Volkswagen', 'Gol', 'AUTO'],
  ['Volkswagen', 'Golf', 'AUTO'],
  ['Volkswagen', 'Polo', 'AUTO'],
  ['Volkswagen', 'Virtus', 'AUTO'],
  ['Volkswagen', 'Vento', 'AUTO'],
  ['Volkswagen', 'Up', 'AUTO'],
  ['Volkswagen', 'Fox', 'AUTO'],

  // ── SUV y crossovers ──
  ['BAIC', 'X35', 'SUV'],
  ['Chery', 'Tiggo 4', 'SUV'],
  ['Chevrolet', 'Tracker', 'SUV'],
  ['Chevrolet', 'Equinox', 'SUV'],
  ['Citroën', 'C4 Cactus', 'SUV'],
  ['Citroën', 'C5 Aircross', 'SUV'],
  ['Fiat', 'Pulse', 'SUV'],
  ['Fiat', 'Fastback', 'SUV'],
  ['Ford', 'EcoSport', 'SUV'],
  ['Ford', 'Territory', 'SUV'],
  ['Ford', 'Kuga', 'SUV'],
  ['Ford', 'Bronco', 'SUV'],
  ['Honda', 'HR-V', 'SUV'],
  ['Honda', 'CR-V', 'SUV'],
  ['Hyundai', 'Creta', 'SUV'],
  ['Hyundai', 'Tucson', 'SUV'],
  ['Jeep', 'Renegade', 'SUV'],
  ['Jeep', 'Compass', 'SUV'],
  ['Jeep', 'Commander', 'SUV'],
  ['Kia', 'Sportage', 'SUV'],
  ['Nissan', 'Kicks', 'SUV'],
  ['Nissan', 'X-Trail', 'SUV'],
  ['Peugeot', '2008', 'SUV'],
  ['Peugeot', '3008', 'SUV'],
  ['Renault', 'Duster', 'SUV'],
  ['Renault', 'Captur', 'SUV'],
  ['Renault', 'Koleos', 'SUV'],
  ['Toyota', 'Corolla Cross', 'SUV'],
  ['Toyota', 'SW4', 'SUV'],
  ['Toyota', 'RAV4', 'SUV'],
  ['Volkswagen', 'T-Cross', 'SUV'],
  ['Volkswagen', 'Nivus', 'SUV'],
  ['Volkswagen', 'Taos', 'SUV'],
  ['Volkswagen', 'Tiguan', 'SUV'],

  // ── Camionetas (pick-ups) ──
  ['Chevrolet', 'S10', 'CAMIONETA'],
  ['Chevrolet', 'Montana', 'CAMIONETA'],
  ['Fiat', 'Toro', 'CAMIONETA'],
  ['Fiat', 'Strada', 'CAMIONETA'],
  ['Ford', 'Ranger', 'CAMIONETA'],
  ['Ford', 'Maverick', 'CAMIONETA'],
  ['Mitsubishi', 'L200', 'CAMIONETA'],
  ['Nissan', 'Frontier', 'CAMIONETA'],
  ['Ram', '1500', 'CAMIONETA'],
  ['Renault', 'Alaskan', 'CAMIONETA'],
  ['Renault', 'Oroch', 'CAMIONETA'],
  ['Toyota', 'Hilux', 'CAMIONETA'],
  ['Volkswagen', 'Amarok', 'CAMIONETA'],
  ['Volkswagen', 'Saveiro', 'CAMIONETA'],

  // ── Utilitarios ──
  ['Citroën', 'Berlingo', 'UTILITARIO'],
  ['Fiat', 'Fiorino', 'UTILITARIO'],
  ['Ford', 'Transit', 'UTILITARIO'],
  ['Mercedes-Benz', 'Sprinter', 'UTILITARIO'],
  ['Mercedes-Benz', 'Vito', 'UTILITARIO'],
  ['Peugeot', 'Partner', 'UTILITARIO'],
  ['Renault', 'Kangoo', 'UTILITARIO'],
  ['Renault', 'Master', 'UTILITARIO'],

  // ── Motos ──
  ['Bajaj', 'Rouser', 'MOTO'],
  ['Corven', 'Energy', 'MOTO'],
  ['Gilera', 'Smash', 'MOTO'],
  ['Honda', 'Wave', 'MOTO'],
  ['Honda', 'CG 150 Titan', 'MOTO'],
  ['Honda', 'XR 150', 'MOTO'],
  ['Motomel', 'Blitz', 'MOTO'],
  ['Yamaha', 'YBR 125', 'MOTO'],
  ['Yamaha', 'FZ', 'MOTO'],
  ['Zanella', 'ZB 110', 'MOTO'],
];

export default CATALOGO_INICIAL;
