import { IsEnum } from 'class-validator';
import { ListarConInactivosDto } from '../../../common/dto/listar-con-inactivos.dto';
import { CatalogoTipo } from '../entities/catalogo-item.entity';

/**
 * Filtros de `GET /catalogos` (HU-34).
 *
 * `tipo` era un `@Query('tipo')` crudo sin validar, y eso daba **dos** fallas:
 *
 * - Omitirlo devolvía **500**. El `undefined` llegaba hasta el `where` de
 *   TypeORM, que lanza `Undefined value encountered in property
 *   'CatalogoItem.tipo'`. Un error del cliente contestado como caída del
 *   servidor, en el endpoint que puebla todos los selectores del sistema.
 * - Mandarlo mal (`?tipo=basura`) devolvía **200 con un array vacío**. Peor que
 *   el 500: el cliente no puede distinguir "escribí mal el parámetro" de "esta
 *   empresa no tiene variedades cargadas", así que un typo se ve como un
 *   catálogo vacío y se busca el bug en la base.
 *
 * Con `@IsEnum` los dos casos son un 400 que dice qué valores son válidos.
 */
export class ListarCatalogoDto extends ListarConInactivosDto {
  @IsEnum(CatalogoTipo, {
    message: `tipo debe ser uno de: ${Object.values(CatalogoTipo).join(', ')}`,
  })
  tipo: CatalogoTipo;
}
