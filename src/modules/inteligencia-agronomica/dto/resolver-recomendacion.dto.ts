import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { EstadoRecomendacion } from '../entities/recomendacion.entity';

/** Estados a los que el Agrónomo puede llevar una recomendación (HU-30). */
export enum EstadoResolucion {
  APLICADA = EstadoRecomendacion.APLICADA,
  DESCARTADA = EstadoRecomendacion.DESCARTADA,
}

export class ResolverRecomendacionDto {
  /**
   * `activa` no está en el enum a propósito: reabrir una recomendación resuelta
   * borraría quién y cuándo la resolvió. Si la condición se repite, la regla
   * genera una recomendación nueva.
   */
  @IsEnum(EstadoResolucion)
  estado: EstadoResolucion;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  nota?: string;
}
