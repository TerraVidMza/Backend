import { IsEnum, IsOptional } from 'class-validator';
import { ModuloAyuda, TipoArticulo } from '../entities/articulo-ayuda.entity';

/**
 * Filtros del manual y las FAQ (HU-36).
 *
 * Los dos son opcionales —sin filtros se devuelve todo el manual—, pero antes
 * llegaban sin validar, así que `?modulo=vendmia` (con el typo) devolvía
 * **200 con la lista vacía**: el usuario ve un centro de ayuda sin artículos y
 * no hay nada que le diga que el filtro está mal escrito.
 */
export class ListarArticulosDto {
  @IsOptional()
  @IsEnum(TipoArticulo, {
    message: `tipo debe ser uno de: ${Object.values(TipoArticulo).join(', ')}`,
  })
  tipo?: TipoArticulo;

  @IsOptional()
  @IsEnum(ModuloAyuda, {
    message: `modulo debe ser uno de: ${Object.values(ModuloAyuda).join(', ')}`,
  })
  modulo?: ModuloAyuda;
}
