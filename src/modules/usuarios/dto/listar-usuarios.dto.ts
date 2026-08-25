import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/**
 * Filtros del listado de usuarios (HU-04). La empresa no se acepta como
 * parámetro: sale siempre del token.
 */
export class ListarUsuariosDto extends PaginationQueryDto {
  /** Búsqueda parcial, sin distinguir mayúsculas, sobre nombre y email. */
  @IsOptional()
  @IsString()
  @Length(1, 100)
  buscar?: string;

  @IsOptional()
  @IsUUID()
  rolId?: string;

  // Los query params son strings: 'false' es truthy, así que sin este
  // Transform `?activo=false` filtraría por activos.
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value as unknown;
  })
  @IsBoolean()
  activo?: boolean;
}
