import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { EsBooleanoDeQuery } from '../../../common/validators/booleano-de-query.validator';

export class ListarNotificacionesDto extends PaginationQueryDto {
  /** `?soloNoLeidas=true` para el badge y el panel de pendientes (HU-35). */
  @EsBooleanoDeQuery()
  soloNoLeidas?: boolean;
}
