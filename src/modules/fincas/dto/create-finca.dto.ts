import {
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

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
   */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  hectareas: number;

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
}
