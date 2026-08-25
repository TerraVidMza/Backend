import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { DetalleInsumoDto } from './detalle-insumo.dto';

export class CreateRegistroLaborDto {
  @IsUUID()
  localUuid: string;

  @IsUUID()
  cuartelId: string;

  @IsUUID()
  tipoLaborId: string;

  @IsDateString()
  fecha: string;

  @IsNumber()
  @Min(0.01)
  cantidad: number;

  @IsArray()
  @ArrayMinSize(0)
  // Un insumo por línea; más de 20 en una misma labor es un error de carga.
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => DetalleInsumoDto)
  insumos: DetalleInsumoDto[];

  /**
   * Momento de creación en el dispositivo (HU-14). Opcional para no romper a
   * los clientes que todavía no lo mandan; sin él se usa la hora del servidor.
   */
  @IsOptional()
  @IsDateString()
  createdAtLocal?: string;
}
