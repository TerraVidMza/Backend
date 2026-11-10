import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { EsAnioImplantacionValido } from '../../../common/validators/anio-implantacion.validator';
import { EsPoligonoGeoJson } from '../../../common/geo/es-poligono-geojson.validator';
import type { PoligonoGeoJson } from '../../../common/geo/poligono';

export class CreateCuartelDto {
  @IsUUID()
  fincaId: string;

  @IsUUID()
  variedadId: string;

  @IsUUID()
  sistemaConduccionId: string;

  @IsString()
  @Length(2, 100)
  nombre: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  clon?: string;

  /**
   * El tope es el año en curso: un cuartel implantado en el futuro no existe, y
   * el dato alimenta el cálculo de edad de la planta.
   */
  @IsOptional()
  @IsInt()
  @EsAnioImplantacionValido()
  anioImplantacion?: number;

  /** Superficie en hectáreas, con 2 decimales como la columna. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  hectareas?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  latitud?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  longitud?: number;

  /**
   * Contorno del cuartel en GeoJSON (`[longitud, latitud]`). Con polígono,
   * `hectareas`, `latitud` y `longitud` se derivan de él. En una edición,
   * `null` quita el polígono y devuelve el cuartel a la carga manual.
   */
  @IsOptional()
  @EsPoligonoGeoJson()
  poligono?: PoligonoGeoJson | null;
}
