import { IsDateString, IsOptional, IsUUID } from 'class-validator';

/**
 * Cada período se identifica por campaña (`campaniaA`/`campaniaB`) o por su par
 * de fechas. El service rechaza el período que no traiga ninguna de las dos
 * formas: es una validación cruzada entre campos, no de un campo suelto.
 */
export class CompararCampaniasDto {
  @IsOptional()
  @IsUUID()
  campaniaA?: string;

  @IsOptional()
  @IsUUID()
  campaniaB?: string;

  @IsOptional()
  @IsDateString()
  desde1?: string;

  @IsOptional()
  @IsDateString()
  hasta1?: string;

  @IsOptional()
  @IsDateString()
  desde2?: string;

  @IsOptional()
  @IsDateString()
  hasta2?: string;
}
