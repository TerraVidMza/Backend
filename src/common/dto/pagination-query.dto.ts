import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Techo duro: sin él, `pageSize=100000` es un modo de agotar la memoria. */
export const TAMANIO_PAGINA_MAXIMO = 100;
export const TAMANIO_PAGINA_POR_DEFECTO = 20;

/**
 * Parámetros de paginación comunes a todos los listados.
 *
 * `@Type(() => Number)` es obligatorio: los query params llegan siempre como
 * string y sin la conversión `@IsInt` rechazaría hasta `?page=1`.
 */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(TAMANIO_PAGINA_MAXIMO)
  pageSize?: number;
}

/** Envelope único de todos los listados paginados. */
export interface ResultadoPaginado<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Normaliza los parámetros a un `{skip, take}` de TypeORM.
 *
 * Se centraliza acá para que ningún listado pueda quedar sin techo: aplicar el
 * default en cada service es exactamente cómo se olvida en uno.
 */
export function calcularPaginacion(query: PaginationQueryDto): {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
} {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(
    TAMANIO_PAGINA_MAXIMO,
    Math.max(1, query.pageSize ?? TAMANIO_PAGINA_POR_DEFECTO),
  );
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/** Arma el envelope a partir del `[data, total]` que devuelve `findAndCount`. */
export function armarResultado<T>(
  [data, total]: [T[], number],
  page: number,
  pageSize: number,
): ResultadoPaginado<T> {
  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
