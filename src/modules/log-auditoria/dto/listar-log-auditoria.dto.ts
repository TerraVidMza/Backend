import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/** Filtros del listado de auditoría (HU-05). */
export class ListarLogAuditoriaDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  entidad?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  accion?: string;

  @IsOptional()
  @IsUUID()
  entidadId?: string;

  /** Inclusive. */
  @IsOptional()
  @IsDateString()
  desde?: string;

  /** Inclusive: se extiende al final del día para no perder el último día. */
  @IsOptional()
  @IsDateString()
  hasta?: string;
}
