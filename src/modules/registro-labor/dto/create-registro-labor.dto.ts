import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
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
  @ValidateNested({ each: true })
  @Type(() => DetalleInsumoDto)
  insumos: DetalleInsumoDto[];
}
