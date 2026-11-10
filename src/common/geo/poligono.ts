/**
 * Polígono en formato GeoJSON (RFC 7946): `coordinates[anillo][vértice]` con
 * cada vértice como `[longitud, latitud]` —en ese orden, que es el contrario de
 * cómo se suele escribir a mano—. El primer anillo es el contorno exterior; los
 * siguientes son huecos.
 *
 * Es el mismo formato que produce Leaflet (`layer.toGeoJSON().geometry`) y que
 * consume `ST_GeomFromGeoJSON`, así que no hay conversión en ningún extremo.
 */
export interface PoligonoGeoJson {
  type: 'Polygon';
  coordinates: number[][][];
}

/** Techos contra abuso: un polígono real de un viñedo tiene decenas de vértices. */
export const MAXIMO_ANILLOS = 10;
export const MAXIMO_VERTICES = 5000;
export const MINIMO_VERTICES_ANILLO = 4;

/** Sistema de coordenadas de la columna: WGS 84, el del GPS y el de Leaflet. */
export const SRID_WGS84 = 4326;
