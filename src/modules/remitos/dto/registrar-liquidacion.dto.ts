import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

/** Liquidación de bodega de un remito aprobado (D-005, HU-15, HU-31). */
export class RegistrarLiquidacionDto {
  @IsString()
  @Length(2, 150)
  bodega: string;

  /**
   * Kilos reconocidos por la bodega. Pueden ser menos que los despachados
   * —descuentos por materia extraña, sanidad o diferencia de balanza—, así que
   * no se derivan del remito.
   */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  kgAceptados: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  precioPorKg: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  descuentos?: number;

  @IsDateString()
  fecha: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  numeroComprobante?: string;
}
