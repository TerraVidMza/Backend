import { IsOptional, IsString, Length } from 'class-validator';

/**
 * Filtro del listado de fincas (HU-08, HU-11).
 *
 * No tenía ningún tope: `search` entraba directo a un `ILIKE '%…%'`, así que
 * nada impedía mandar un parámetro de megabytes y hacerle recorrer eso a la
 * base en cada fila. El límite es el mismo que ya usan las otras búsquedas
 * (`ListarUsuariosDto.buscar`, `ListarCuartelesDto.buscar`), para que las tres
 * se comporten igual.
 */
export class ListarFincasDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  search?: string;
}
