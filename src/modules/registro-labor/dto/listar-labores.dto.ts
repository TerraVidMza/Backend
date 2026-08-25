import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/** Filtros del historial de labores por cuartel (HU-17). */
export class ListarLaboresDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  tipoLaborId?: string;

  @IsOptional()
  @IsUUID()
  usuarioId?: string;

  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;
}
