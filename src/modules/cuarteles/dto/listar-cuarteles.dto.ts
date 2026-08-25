import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { EsBooleanoDeQuery } from '../../../common/validators/booleano-de-query.validator';
import { EsEnteroDeQuery } from '../../../common/validators/entero-de-query.validator';
import { EstadoCuartel } from '../entities/estado-cuartel.enum';

/** Campos por los que HU-11 permite ordenar. */
export const CAMPOS_ORDEN_CUARTEL = [
  'nombre',
  'hectareas',
  'anioImplantacion',
  'createdAt',
] as const;

export type CampoOrdenCuartel = (typeof CAMPOS_ORDEN_CUARTEL)[number];

/**
 * Búsqueda y filtros de cuarteles (HU-11).
 *
 * `fincaId` es opcional: la búsqueda de HU-11 es a nivel de empresa, y exigirlo
 * obligaba a recorrer finca por finca desde el cliente.
 */
export class ListarCuartelesDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  fincaId?: string;

  /** Búsqueda parcial sobre el nombre del cuartel. */
  @IsOptional()
  @IsString()
  @Length(1, 100)
  buscar?: string;

  @IsOptional()
  @IsUUID()
  variedadId?: string;

  @IsOptional()
  @IsEnum(EstadoCuartel)
  estado?: EstadoCuartel;

  @EsEnteroDeQuery()
  anioImplantacion?: number;

  @EsBooleanoDeQuery()
  activo?: boolean;

  @IsOptional()
  @IsIn(CAMPOS_ORDEN_CUARTEL)
  ordenarPor?: CampoOrdenCuartel;

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  orden?: 'ASC' | 'DESC';
}
