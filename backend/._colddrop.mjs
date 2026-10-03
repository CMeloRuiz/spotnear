// Deja la base quieta hasta que el pooler de Neon cierre la conexión, y después
// hace UNA reserva, que es el request que falla en el primer intento.
import 'dotenv/config';
import prisma from './src/config/prisma.js';

const API = 'http://127.0.0.1:4000/api/v1';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

console.log('calentando la conexión...');
await prisma.$queryRaw`SELECT 1`;

const MINUTOS = 6;
console.log(`esperando ${MINUTOS} minutos sin tocar la base...`);
await esperar(MINUTOS * 60_000);

console.log('\n── primer request después del silencio ──');
const ini = new Date(Date.now() + 3 * 86_400_000); ini.setHours(11, 0, 0, 0);
const fin = new Date(ini); fin.setHours(14, 0, 0, 0);

const busq = await (await fetch(`${API}/parkings?lat=-34.5965&lng=-58.4489&radio=2500&inicio=${ini.toISOString()}&fin=${fin.toISOString()}`)).json();

for (const [i, patente] of [['1','CD111AA'],['2','CD222BB']]) {
  const t0 = Date.now();
  try {
    const r = await fetch(`${API}/reservations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parkingId: busq.resultados[0].id, inicio: ini.toISOString(), fin: fin.toISOString(),
        cliente: { nombre: 'Cold', apellido: 'Drop', telefono: '11 6117 3398' },
        vehiculo: { patente, tipo: 'AUTO' },
      }),
    });
    const j = await r.json();
    console.log(`intento ${i}: HTTP ${r.status} en ${Date.now()-t0} ms →`, j.reserva?.codigo ?? JSON.stringify(j.error).slice(0,120));
  } catch (e) {
    console.log(`intento ${i}: FALLÓ en ${Date.now()-t0} ms →`, e.name, e.message, e.cause?.code ?? '');
  }
}
await prisma.$disconnect();
