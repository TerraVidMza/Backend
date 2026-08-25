import { IsDateString, IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/** Granularidades admitidas para el gráfico de HU-20. */
export const GRANULARIDADES = ['hora', 'dia'] as const;
export type Granularidad = (typeof GRANULARIDADES)[number];

/**
 * Historial de lecturas de un sensor (HU-19, HU-20).
 *
 * Sin rango de fechas la única forma de ver un período era traer las últimas N
 * lecturas y descartar en el cliente.
 */
export class ListarLecturasDto extends PaginationQueryDto {
  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;
}

/**
 * Serie agregada para graficar (HU-20).
 *
 * Un mes de un sensor que mide cada 5 minutos son ~9.000 puntos: más de los que
 * cualquier gráfico puede dibujar y muchos más de los que conviene transferir.
 * La agregación se hace en SQL.
 */
export class SerieLecturasDto {
  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;

  @IsOptional()
  @IsIn(GRANULARIDADES)
  granularidad?: Granularidad;
}
