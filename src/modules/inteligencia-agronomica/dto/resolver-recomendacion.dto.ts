import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { EstadoRecomendacion } from '../entities/recomendacion.entity';

/**
 * Estados a los que el Agrónomo puede llevar una recomendación (HU-30).
 *
 * Con literales y no `= EstadoRecomendacion.APLICADA`: un enum con miembros
 * calculados hace que TypeScript emita `Number` como tipo de la propiedad, y la
 * conversión implícita del `ValidationPipe` convertía `"aplicada"` en `NaN`.
 * Resultado: **ninguna recomendación se podía resolver por la API** (400).
 * El `satisfies` de abajo mantiene la equivalencia con la entidad.
 */
export enum EstadoResolucion {
  APLICADA = 'aplicada',
  DESCARTADA = 'descartada',
}

const _equivalentes = {
  [EstadoResolucion.APLICADA]: EstadoRecomendacion.APLICADA,
  [EstadoResolucion.DESCARTADA]: EstadoRecomendacion.DESCARTADA,
} satisfies Record<EstadoResolucion, `${EstadoRecomendacion}`>;
void _equivalentes;

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
