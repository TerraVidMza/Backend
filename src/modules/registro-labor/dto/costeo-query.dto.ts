import { IsDateString, IsOptional, IsUUID } from 'class-validator';

/**
 * Filtros de la tabla de costeo por cuartel (HU-15).
 *
 * Sin `fincaId` la tabla abarca toda la empresa, que es la vista que pide el
 * criterio "comparar el costo de mis cuarteles".
 */
export class CosteoQueryDto {
  @IsOptional()
  @IsUUID()
  fincaId?: string;

  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;
}
