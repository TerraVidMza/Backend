import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class ListarRecomendacionesDto {
  /** Por defecto solo las activas: son las que esperan una decisión. */
  @IsOptional()
  @IsIn(['activa', 'todas'])
  estado?: 'activa' | 'todas';

  @IsOptional()
  @IsUUID()
  fincaId?: string;
}

export class EvaluarRecomendacionesDto {
  @IsOptional()
  @IsUUID()
  fincaId?: string;
}
