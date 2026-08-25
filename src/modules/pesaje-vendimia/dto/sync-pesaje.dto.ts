import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { CreatePesajeDto } from './create-pesaje.dto';

/**
 * HU-14 fija el tamaño de lote en 10 registros por request: mantiene la
 * respuesta corta sobre conexiones rurales inestables y permite mostrar el
 * progreso "sincronizando X de N" con granularidad útil.
 */
export const MAXIMO_REGISTROS_POR_LOTE = 10;

export class SyncPesajeDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAXIMO_REGISTROS_POR_LOTE)
  @ValidateNested({ each: true })
  @Type(() => CreatePesajeDto)
  pesajes: CreatePesajeDto[];
}
