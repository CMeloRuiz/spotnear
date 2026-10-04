/**
 * Búsqueda y presentación de estacionamientos.
 *
 * La búsqueda prefiltra por caja geográfica en SQL y después calcula la
 * distancia exacta en memoria. Para el volumen de Buenos Aires (cientos de
 * estacionamientos) rinde de sobra; si algún día son decenas de miles,
 * el salto natural es PostGIS con un índice GIST sobre la geometría.
 */
import prisma from '../../config/prisma.js';
import errores from '../../utils/errors.js';
import { distanciaEnMetros, minutosCaminando, cajaDeBusqueda } from '../../utils/geo.js';
import { calcularPrecio, tarifaDesde } from '../../services/pricing.js';
import { disponibilidadEnLote } from '../../services/availability.js';
import { aNumero } from '../../utils/money.js';

/** Campos que se exponen públicamente de un estacionamiento. */
const SELECT_PUBLICO = {
  id: true,
  slug: true,
  nombre: true,
  descripcion: true,
  direccion: true,
  barrio: true,
  ciudad: true,
  lat: true,
  lng: true,
  capacidadTotal: true,
  cubierto: true,
  tiposVehiculo: true,
  servicios: true,
  tipoHorario: true,
  horarios: true,
  alturaMaximaCm: true,
  calificacion: true,
  cantidadResenas: true,
  destacado: true,
  comisionPorcentaje: true,
  moneda: true,
  fotos: { select: { url: true, alt: true, portada: true, orden: true }, orderBy: { orden: 'asc' } },
  tarifas: {
    where: { activo: true },
    select: {
      id: true,
      tipo: true,
      precio: true,
      descripcion: true,
      vehicleType: true,
      vigenciaDesde: true,
      vigenciaHasta: true,
      activo: true,
    },
  },
};

/** Foto de portada, o la primera, o null. */
function fotoPortada(fotos = []) {
  return fotos.find((f) => f.portada) ?? fotos[0] ?? null;
}

/**
 * Convierte un registro de Prisma en el objeto que consume el frontend.
 * Nunca expone comisión ni datos internos al público.
 */
export function aParkingPublico(parking, extra = {}) {
  const desde = tarifaDesde(parking.tarifas ?? []);

  return {
    id: parking.id,
    slug: parking.slug,
    nombre: parking.nombre,
    descripcion: parking.descripcion ?? null,
    direccion: parking.direccion,
    barrio: parking.barrio ?? null,
    ciudad: parking.ciudad,
    lat: parking.lat,
    lng: parking.lng,
    capacidadTotal: parking.capacidadTotal,
    cubierto: parking.cubierto,
    tiposVehiculo: parking.tiposVehiculo,
    servicios: parking.servicios,
    tipoHorario: parking.tipoHorario,
    horarios: parking.horarios,
    alturaMaximaCm: parking.alturaMaximaCm ?? null,
    calificacion: parking.calificacion !== null ? aNumero(parking.calificacion) : null,
    cantidadResenas: parking.cantidadResenas,
    destacado: parking.destacado,
    foto: fotoPortada(parking.fotos)?.url ?? null,
    fotos: (parking.fotos ?? []).map((f) => ({ url: f.url, alt: f.alt })),
    precioDesde: desde?.precio ?? null,
    tarifas: (parking.tarifas ?? []).map((t) => ({
      id: t.id,
      tipo: t.tipo,
      precio: aNumero(t.precio),
      descripcion: t.descripcion ?? null,
      vehicleType: t.vehicleType ?? null,
    })),
    ...extra,
  };
}

/**
 * Búsqueda pública de estacionamientos.
 *
 * @param {object} filtros
 * @param {number} filtros.lat
 * @param {number} filtros.lng
 * @param {number} [filtros.radio=2500] metros
 * @param {Date}   filtros.inicio
 * @param {Date}   filtros.fin
 * @param {'HORARIO'|'MENSUAL'} [filtros.modalidad]
 * @param {string} [filtros.tipoVehiculo]
 * @param {boolean}[filtros.cubierto]
 * @param {number} [filtros.precioMax]
 * @param {number} [filtros.calificacionMin]
 * @param {string[]}[filtros.servicios]
 * @param {boolean}[filtros.soloDisponibles=true]
 * @param {'RELEVANCIA'|'PRECIO'|'DISTANCIA'|'CALIFICACION'} [filtros.orden]
 */
export async function buscarParkings(filtros) {
  const {
    lat,
    lng,
    radio = 2500,
    inicio,
    fin,
    modalidad = 'HORARIO',
    tipoVehiculo = null,
    cubierto,
    precioMax,
    calificacionMin,
    servicios = [],
    cantidadVehiculos = 1,
    soloDisponibles = true,
    orden = 'RELEVANCIA',
  } = filtros;

  const caja = cajaDeBusqueda(lat, lng, radio);

  const where = {
    activo: true,
    publicado: true,
    // Las solicitudes pendientes y las rechazadas no se muestran nunca.
    estado: 'ACTIVO',
    lat: { gte: caja.latMin, lte: caja.latMax },
    lng: { gte: caja.lngMin, lte: caja.lngMax },
  };
  if (cubierto !== undefined) where.cubierto = cubierto;
  if (tipoVehiculo) where.tiposVehiculo = { has: tipoVehiculo };
  if (servicios.length > 0) where.servicios = { hasEvery: servicios };
  if (calificacionMin) where.calificacion = { gte: calificacionMin };

  const candidatos = await prisma.parking.findMany({ where, select: SELECT_PUBLICO });

  // Distancia real (la caja es un cuadrado, el radio es un círculo)
  const conDistancia = candidatos
    .map((p) => {
      const metros = distanciaEnMetros(lat, lng, p.lat, p.lng);
      return { parking: p, distanciaMetros: metros };
    })
    .filter((x) => x.distanciaMetros <= radio);

  if (conDistancia.length === 0) return [];

  const disponibilidades = await disponibilidadEnLote(
    conDistancia.map((x) => x.parking),
    inicio,
    fin,
    cantidadVehiculos,
  );

  const resultados = [];

  for (const { parking, distanciaMetros } of conDistancia) {
    let precio = null;
    try {
      precio = calcularPrecio({
        parking,
        tarifas: parking.tarifas,
        inicio,
        fin,
        vehicleType: tipoVehiculo,
        cantidadVehiculos,
        modalidad,
      });
    } catch {
      // Sin tarifa aplicable (ej: sin tarifa mensual) el estacionamiento
      // simplemente no participa de esta búsqueda.
      continue;
    }

    if (precioMax !== undefined && precio.precioTotal > precioMax) continue;

    const disp = disponibilidades.get(parking.id) ?? { libres: 0, hayLugar: false };
    if (soloDisponibles && !disp.hayLugar) continue;

    resultados.push(
      aParkingPublico(parking, {
        distanciaMetros,
        minutosCaminando: minutosCaminando(distanciaMetros),
        precio: {
          subtotal: precio.subtotal,
          sena: precio.montoComision,
          aPagarAhora: precio.montoComision,
          aPagarEnElLugar: precio.montoNeto,
          total: precio.precioTotal,
          moneda: precio.moneda,
          desglose: precio.desglose,
        },
        disponibilidad: {
          libres: disp.libres,
          hayLugar: disp.hayLugar,
          capacidadTotal: disp.capacidadTotal ?? parking.capacidadTotal,
        },
      }),
    );
  }

  ordenarResultados(resultados, orden);

  // Los que no tienen lugar en ese horario (cuando se los pide, con
  // soloDisponibles=false) van al final y sin etiquetas: "Más cerca" o "Más
  // barato" sobre uno que no se puede reservar sería invitar a un clic inútil.
  const conLugar = resultados.filter((r) => r.disponibilidad.hayLugar);
  const sinLugar = resultados.filter((r) => !r.disponibilidad.hayLugar);
  for (const r of sinLugar) r.etiquetas = [];
  asignarEtiquetas(conLugar);

  return [...conLugar, ...sinLugar];
}

/** Ordena in-place según el criterio elegido. */
function ordenarResultados(resultados, orden) {
  switch (orden) {
    case 'PRECIO':
      resultados.sort((a, b) => a.precio.total - b.precio.total);
      break;
    case 'DISTANCIA':
      resultados.sort((a, b) => a.distanciaMetros - b.distanciaMetros);
      break;
    case 'CALIFICACION':
      resultados.sort((a, b) => (b.calificacion ?? 0) - (a.calificacion ?? 0));
      break;
    case 'RELEVANCIA':
    default: {
      // Relevancia = mezcla de cercanía, precio y reputación, normalizada 0..1.
      // Los destacados suben un escalón. Es simple a propósito y se puede
      // reemplazar por un modelo más fino sin tocar el resto del código.
      const maxDist = Math.max(...resultados.map((r) => r.distanciaMetros), 1);
      const maxPrecio = Math.max(...resultados.map((r) => r.precio.total), 1);

      for (const r of resultados) {
        const cercania = 1 - r.distanciaMetros / maxDist;
        const conveniencia = 1 - r.precio.total / maxPrecio;
        const reputacion = (r.calificacion ?? 3.5) / 5;
        r._score =
          cercania * 0.45 + conveniencia * 0.3 + reputacion * 0.25 + (r.destacado ? 0.1 : 0);
      }
      resultados.sort((a, b) => b._score - a._score);
      for (const r of resultados) delete r._score;
      break;
    }
  }
}

/** Etiquetas tipo "Más cerca" / "Mejor calificado" / "Más barato". */
function asignarEtiquetas(resultados) {
  if (resultados.length === 0) return;

  for (const r of resultados) r.etiquetas = [];

  const sinEtiqueta = (r) => r.etiquetas.length === 0;

  // Cada etiqueta va a una tarjeta distinta: repetirlas todas en la misma
  // no aporta nada y deja al resto del listado sin ninguna señal.
  const masCerca = resultados.reduce((m, r) => (r.distanciaMetros < m.distanciaMetros ? r : m));
  masCerca.etiquetas.push('MAS_CERCA');

  const candidatosBarato = resultados.filter(sinEtiqueta);
  if (candidatosBarato.length > 0) {
    candidatosBarato
      .reduce((m, r) => (r.precio.total < m.precio.total ? r : m))
      .etiquetas.push('MAS_BARATO');
  }

  const candidatosCalificacion = resultados.filter((r) => sinEtiqueta(r) && r.calificacion !== null);
  if (candidatosCalificacion.length > 0) {
    candidatosCalificacion
      .reduce((m, r) => (r.calificacion > m.calificacion ? r : m))
      .etiquetas.push('MEJOR_CALIFICADO');
  }
}

/**
 * Detalle público de un estacionamiento por slug o id.
 * Si se pasan inicio y fin, incluye precio y disponibilidad para ese rango.
 */
export async function detalleParking(idOSlug, opciones = {}) {
  const parking = await prisma.parking.findFirst({
    where: {
      OR: [{ slug: idOSlug }, { id: idOSlug }],
      activo: true,
      publicado: true,
      estado: 'ACTIVO',
    },
    select: {
      ...SELECT_PUBLICO,
      camposExtra: {
        where: { activo: true },
        orderBy: { orden: 'asc' },
        select: {
          key: true,
          label: true,
          ayuda: true,
          tipo: true,
          requerido: true,
          opciones: true,
          orden: true,
        },
      },
    },
  });

  if (!parking) throw errores.noEncontrado('El estacionamiento');

  const extra = { camposExtra: parking.camposExtra ?? [] };

  if (opciones.inicio && opciones.fin) {
    const disp = await disponibilidadEnLote(
      [parking],
      opciones.inicio,
      opciones.fin,
      opciones.cantidadVehiculos ?? 1,
    );
    const info = disp.get(parking.id);

    extra.disponibilidad = {
      libres: info?.libres ?? 0,
      hayLugar: info?.hayLugar ?? false,
      capacidadTotal: parking.capacidadTotal,
    };

    try {
      const precio = calcularPrecio({
        parking,
        tarifas: parking.tarifas,
        inicio: opciones.inicio,
        fin: opciones.fin,
        vehicleType: opciones.tipoVehiculo ?? null,
        cantidadVehiculos: opciones.cantidadVehiculos ?? 1,
        modalidad: opciones.modalidad ?? 'HORARIO',
      });
      extra.precio = {
        subtotal: precio.subtotal,
        sena: precio.montoComision,
        aPagarAhora: precio.montoComision,
        aPagarEnElLugar: precio.montoNeto,
        total: precio.precioTotal,
        moneda: precio.moneda,
        desglose: precio.desglose,
      };
    } catch (error) {
      extra.precio = null;
      extra.precioError = error.message;
    }
  }

  return aParkingPublico(parking, extra);
}

/**
 * Cotización: cuánto sale reservar en este estacionamiento en este horario.
 * Endpoint aparte para que el checkout pueda recalcular sin crear nada.
 */
export async function cotizar({
  parkingId,
  inicio,
  fin,
  tipoVehiculo = null,
  cantidadVehiculos = 1,
  modalidad = 'HORARIO',
}) {
  const parking = await prisma.parking.findFirst({
    where: { OR: [{ id: parkingId }, { slug: parkingId }], activo: true, estado: 'ACTIVO' },
    select: {
      id: true,
      nombre: true,
      slug: true,
      capacidadTotal: true,
      comisionPorcentaje: true,
      moneda: true,
      tarifas: SELECT_PUBLICO.tarifas,
    },
  });

  if (!parking) throw errores.noEncontrado('El estacionamiento');

  const precio = calcularPrecio({
    parking,
    tarifas: parking.tarifas,
    inicio,
    fin,
    vehicleType: tipoVehiculo,
    cantidadVehiculos,
    modalidad,
  });

  const disp = await disponibilidadEnLote([parking], inicio, fin, cantidadVehiculos);
  const info = disp.get(parking.id);

  return {
    parking: { id: parking.id, nombre: parking.nombre, slug: parking.slug },
    // El cliente ve los tres montos: lo que le cobra el estacionamiento (que
    // paga allá), la seña que paga ahora, y el total de la reserva.
    subtotal: precio.subtotal,
    sena: precio.montoComision,
    aPagarAhora: precio.montoComision,
    aPagarEnElLugar: precio.montoNeto,
    precioTotal: precio.precioTotal,
    moneda: precio.moneda,
    desglose: precio.desglose,
    disponibilidad: {
      libres: info?.libres ?? 0,
      hayLugar: info?.hayLugar ?? false,
      capacidadTotal: parking.capacidadTotal,
    },
  };
}

export { SELECT_PUBLICO };
export default { buscarParkings, detalleParking, cotizar, aParkingPublico };
