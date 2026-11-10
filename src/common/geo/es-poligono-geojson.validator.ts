import { registerDecorator, ValidationOptions } from 'class-validator';
import {
  MAXIMO_ANILLOS,
  MAXIMO_VERTICES,
  MINIMO_VERTICES_ANILLO,
} from './poligono';

/**
 * Motivo por el que `valor` no es un polígono GeoJSON aceptable, o `null` si lo
 * es. Valida la **forma** —tipo, anillos cerrados, coordenadas en rango—, que se
 * puede comprobar sin la base. Que el polígono no se cruce a sí mismo lo decide
 * PostGIS (`ST_IsValid`) en `GeoService`.
 */
export function motivoPoligonoInvalido(valor: unknown): string | null {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    return 'debe ser un objeto GeoJSON { type, coordinates }';
  }
  const { type, coordinates } = valor as {
    type?: unknown;
    coordinates?: unknown;
  };
  if (type !== 'Polygon') return 'type debe ser "Polygon"';
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return 'coordinates debe ser una lista de anillos';
  }
  if (coordinates.length > MAXIMO_ANILLOS) {
    return `tiene demasiados anillos (máximo ${MAXIMO_ANILLOS}: el contorno y sus huecos)`;
  }

  let vertices = 0;
  for (const [i, anillo] of coordinates.entries()) {
    if (!Array.isArray(anillo) || anillo.length < MINIMO_VERTICES_ANILLO) {
      return `el anillo ${i} necesita al menos ${MINIMO_VERTICES_ANILLO} vértices (el último repite el primero)`;
    }
    vertices += anillo.length;
    if (vertices > MAXIMO_VERTICES) {
      return `tiene demasiados vértices (máximo ${MAXIMO_VERTICES})`;
    }
    for (const vertice of anillo) {
      if (!Array.isArray(vertice) || vertice.length !== 2) {
        return `cada vértice debe ser [longitud, latitud] (anillo ${i})`;
      }
      const [lng, lat] = vertice as unknown[];
      if (
        typeof lng !== 'number' ||
        typeof lat !== 'number' ||
        !Number.isFinite(lng) ||
        !Number.isFinite(lat)
      ) {
        return `los vértices deben ser números (anillo ${i})`;
      }
      if (lng < -180 || lng > 180)
        return `longitud fuera de rango -180..180 (anillo ${i})`;
      if (lat < -90 || lat > 90)
        return `latitud fuera de rango -90..90 (anillo ${i})`;
    }
    const primero = anillo[0] as number[];
    const ultimo = anillo[anillo.length - 1] as number[];
    if (primero[0] !== ultimo[0] || primero[1] !== ultimo[1]) {
      return `el anillo ${i} no está cerrado: el último vértice debe repetir el primero`;
    }
  }
  return null;
}

export function EsPoligonoGeoJson(options?: ValidationOptions) {
  return function (objeto: object, propiedad: string) {
    registerDecorator({
      name: 'esPoligonoGeoJson',
      target: objeto.constructor,
      propertyName: propiedad,
      options,
      validator: {
        validate(valor: unknown) {
          return motivoPoligonoInvalido(valor) === null;
        },
        defaultMessage(args) {
          return `${args?.property ?? 'poligono'} no es un polígono GeoJSON válido: ${motivoPoligonoInvalido(args?.value)}.`;
        },
      },
    });
  };
}
