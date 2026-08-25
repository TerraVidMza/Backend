import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { EstadoRemito } from '../entities/remito.entity';

/**
 * Filtros del listado de remitos (HU-26, HU-27).
 *
 * `cuartelId` es opcional a propósito: cuando era obligatorio, el panel de
 * aprobaciones del Propietario —"todos los remitos en borrador de mi empresa"—
 * no se podía expresar, y había que recorrer cuartel por cuartel.
 */
export class ListarRemitosDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  cuartelId?: string;

  @IsOptional()
  @IsEnum(EstadoRemito)
  estado?: EstadoRemito;

  @IsOptional()
  @IsUUID()
  fincaId?: string;
}
