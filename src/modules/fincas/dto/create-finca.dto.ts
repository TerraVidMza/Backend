import {
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { EsPoligonoGeoJson } from '../../../common/geo/es-poligono-geojson.validator';
import type { PoligonoGeoJson } from '../../../common/geo/poligono';

export class CreateFincaDto {
  @IsString()
  @Length(2, 100)
  nombre: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  ubicacion?: string;

  /**
   * Superficie con 2 decimales, como la columna. El mínimo es `0.01` y no `0`:
   * una finca de cero hectáreas divide por cero en todos los indicadores por
   * hectárea (HU-15, HU-31).
   *
   * Obligatoria solo si no se manda `poligono`: con polígono se calcula de él
   * y lo que venga acá se descarta (ver `GeoService.derivar`).
   */
  @ValidateIf((dto: CreateFincaDto) => !dto.poligono)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  hectareas?: number;

  // `empresaId` no se acepta del body: sale del token del usuario autenticado.
  // Recibirlo permitía crear fincas en otra empresa.

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitud?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitud?: number;

  /**
   * Contorno de la finca en GeoJSON (`[longitud, latitud]`). Con polígono,
   * `hectareas`, `latitud` y `longitud` se derivan de él. En una edición,
   * `null` quita el polígono y devuelve la finca a la carga manual.
   */
  @IsOptional()
  @EsPoligonoGeoJson()
  poligono?: PoligonoGeoJson | null;
}
