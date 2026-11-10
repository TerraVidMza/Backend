import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PoligonoGeoJson, SRID_WGS84 } from './poligono';

/** Lo que se deriva de un polígono y reemplaza a lo cargado a mano. */
export interface AnalisisPoligono {
  hectareas: number;
  latitud: number;
  longitud: number;
}

/** Datos que pueden venir en un alta o una edición de finca / cuartel. */
interface EntradaGeo {
  poligono?: PoligonoGeoJson | null;
  hectareas?: number | null;
  latitud?: number | null;
  longitud?: number | null;
}

/** Lo que ya guarda la finca / cuartel que se está editando. */
interface EstadoGeo {
  poligono: PoligonoGeoJson | null;
  hectareas: number | string | null;
  latitud: number | string | null;
  longitud: number | string | null;
}

/** 0,01 ha = 100 m²; 100.000 ha entra de sobra en `decimal(8,2)`. */
export const HECTAREAS_MINIMAS = 0.01;
export const HECTAREAS_MAXIMAS = 100_000;

/**
 * Metros de tolerancia al decidir si un cuartel está dentro de la finca. Un
 * contorno dibujado a mano sobre un mapa nunca coincide al metro con el vecino.
 */
export const TOLERANCIA_CONTENCION_M = 15;

const redondear = (n: number, decimales: number): number =>
  Math.round(n * 10 ** decimales) / 10 ** decimales;

/**
 * Cálculos espaciales de fincas y cuarteles (PostGIS).
 *
 * Todo se delega a la base: la superficie sobre el elipsoide
 * (`geography`), el punto interior y la contención no se aproximan en
 * JavaScript. Ninguna consulta escribe nada.
 */
@Injectable()
export class GeoService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Valida el polígono y devuelve lo que se deriva de él: superficie en
   * hectáreas y un punto garantizado **dentro** del contorno (no el centroide,
   * que en un polígono cóncavo puede caer afuera) para el marcador del mapa.
   *
   * Lanza 400 si el polígono se cruza a sí mismo o si su superficie es absurda.
   */
  async analizar(poligono: PoligonoGeoJson): Promise<AnalisisPoligono> {
    const filas = await this.dataSource
      .query<
        Array<{
          valido: boolean;
          motivo: string | null;
          hectareas: string | null;
          latitud: string | null;
          longitud: string | null;
        }>
      >(
        `WITH g AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), ${SRID_WGS84}) AS geom)
         SELECT ST_IsValid(geom) AS valido,
                ST_IsValidReason(geom) AS motivo,
                CASE WHEN ST_IsValid(geom) THEN ST_Area(geom::geography) / 10000 END AS hectareas,
                CASE WHEN ST_IsValid(geom) THEN ST_Y(ST_PointOnSurface(geom)) END AS latitud,
                CASE WHEN ST_IsValid(geom) THEN ST_X(ST_PointOnSurface(geom)) END AS longitud
           FROM g`,
        [JSON.stringify(poligono)],
      )
      .catch(() => {
        throw new BadRequestException(
          'El polígono no es un GeoJSON que se pueda interpretar.',
        );
      });

    const fila = filas[0];
    if (!fila?.valido) {
      throw new BadRequestException(
        `El polígono no es válido: se cruza a sí mismo o su contorno es inconsistente (${fila?.motivo ?? 'sin detalle'}).`,
      );
    }

    const hectareas = redondear(Number(fila.hectareas), 2);
    if (hectareas < HECTAREAS_MINIMAS) {
      throw new BadRequestException(
        `El polígono es demasiado chico: mide ${hectareas} ha y el mínimo es ${HECTAREAS_MINIMAS}.`,
      );
    }
    if (hectareas > HECTAREAS_MAXIMAS) {
      throw new BadRequestException(
        `El polígono es demasiado grande: mide ${hectareas} ha y el máximo es ${HECTAREAS_MAXIMAS}. ¿Las coordenadas están como [longitud, latitud]?`,
      );
    }

    return {
      hectareas,
      latitud: redondear(Number(fila.latitud), 7),
      longitud: redondear(Number(fila.longitud), 7),
    };
  }

  /**
   * Decide qué valores se escriben en la finca / cuartel según traiga o no
   * polígono, para que `hectareas`, `latitud` y `longitud` no se contradigan
   * con el contorno:
   *
   * - **Con polígono:** esos tres campos se derivan de él y pisan lo que
   *   hubiera en el pedido.
   * - **`poligono: null`:** se quita el contorno y la entidad vuelve a la carga
   *   manual; ahí sí se aceptan los tres campos del pedido.
   * - **Sin `poligono` en el pedido, y la entidad ya tiene uno:** los tres
   *   campos no se pueden cambiar a mano (400), porque dejarían de coincidir
   *   con el contorno. Mandar el valor que ya tiene no es un cambio.
   *
   * Devuelve las columnas derivadas, o `{}` si no corresponde pisar ninguna.
   */
  async derivar(
    dto: EntradaGeo,
    actual: EstadoGeo | null,
    entidad: 'finca' | 'cuartel',
  ): Promise<Partial<AnalisisPoligono>> {
    if (dto.poligono) {
      return this.analizar(dto.poligono);
    }

    if (dto.poligono === undefined && actual?.poligono) {
      const cambios = (['hectareas', 'latitud', 'longitud'] as const).filter(
        (campo) =>
          dto[campo] !== undefined &&
          dto[campo] !== null &&
          Number(dto[campo]) !== Number(actual[campo]),
      );
      if (cambios.length > 0) {
        const demostrativo =
          entidad === 'finca' ? 'Esta finca' : 'Este cuartel';
        throw new BadRequestException(
          `${demostrativo} tiene polígono: ${cambios.join(', ')} se calcula(n) a partir de él. Editá el polígono, o quitalo para cargar los valores a mano.`,
        );
      }
    }
    return {};
  }

  /**
   * Advertencia (no error) si el polígono del cuartel se sale del de su finca.
   * Devuelve `null` si la finca no tiene polígono, o si el cuartel queda
   * adentro dentro de la tolerancia.
   */
  async advertenciaCuartelFueraDeFinca(
    fincaId: string,
    poligonoCuartel: PoligonoGeoJson,
  ): Promise<string | null> {
    const filas = await this.dataSource.query<
      Array<{ fuera: boolean; porcentaje: string | null }>
    >(
      `WITH c AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON($2), ${SRID_WGS84}) AS geom)
       SELECT NOT ST_Covers(ST_Buffer(f.poligono::geography, ${TOLERANCIA_CONTENCION_M})::geometry, c.geom) AS fuera,
              100 * ST_Area(ST_Difference(c.geom, f.poligono)::geography) / NULLIF(ST_Area(c.geom::geography), 0) AS porcentaje
         FROM fincas f, c
        WHERE f.id = $1 AND f.poligono IS NOT NULL`,
      [fincaId, JSON.stringify(poligonoCuartel)],
    );

    const fila = filas[0];
    if (!fila?.fuera) return null;
    return `El polígono del cuartel se sale del contorno de la finca (aprox. ${redondear(Number(fila.porcentaje), 1)} % queda afuera). Revisá que esté bien dibujado.`;
  }

  /**
   * Advertencia si, al cambiar el contorno de la finca, hay cuarteles activos
   * con polígono que quedan fuera. Lista los nombres.
   */
  async advertenciaCuartelesFueraDelContorno(
    fincaId: string,
    poligonoFinca: PoligonoGeoJson,
  ): Promise<string | null> {
    const filas = await this.dataSource.query<Array<{ nombre: string }>>(
      `WITH f AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON($2), ${SRID_WGS84}) AS geom)
       SELECT c.nombre
         FROM cuarteles c, f
        WHERE c.finca_id = $1
          AND c.activo = true
          AND c.poligono IS NOT NULL
          AND NOT ST_Covers(ST_Buffer(f.geom::geography, ${TOLERANCIA_CONTENCION_M})::geometry, c.poligono)
        ORDER BY c.nombre`,
      [fincaId, JSON.stringify(poligonoFinca)],
    );

    if (filas.length === 0) return null;
    const nombres = filas.map((f) => f.nombre).join(', ');
    return filas.length === 1
      ? `Un cuartel con polígono queda fuera del nuevo contorno de la finca: ${nombres}.`
      : `${filas.length} cuarteles con polígono quedan fuera del nuevo contorno de la finca: ${nombres}.`;
  }
}
