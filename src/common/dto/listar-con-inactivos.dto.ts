import { EsBooleanoDeQuery } from '../validators/booleano-de-query.validator';

/**
 * Listados de catálogo que por defecto devuelven solo los registros activos y
 * aceptan `?incluirInactivos=true` para traer el histórico completo.
 *
 * Lo comparten catálogos, insumos y tipos de labor. Antes los tres leían el
 * parámetro crudo y lo comparaban con `!== 'true'`, así que cualquier valor que
 * no fuera exactamente esa cadena —incluido un `?incluirInactivos=1` bien
 * intencionado— se interpretaba en silencio como "solo activos".
 */
export class ListarConInactivosDto {
  @EsBooleanoDeQuery()
  incluirInactivos?: boolean;
}
