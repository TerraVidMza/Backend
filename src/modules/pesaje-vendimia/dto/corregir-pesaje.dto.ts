import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

/**
 * Corrección de un pesaje `observado` (remito rechazado). Solo se corrige lo
 * que pudo estar mal: la cuadrilla, la fecha y los kilos. El cuartel y quién
 * lo registró no se tocan: cambiarlos sería otro pesaje, no una corrección.
 */
export class CorregirPesajeDto {
  @IsOptional()
  @IsUUID()
  cuadrillaId?: string;

  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  kgTotales?: number;
}
