import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreatePesajeDto } from './create-pesaje.dto';

export class SyncPesajeDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePesajeDto)
  pesajes: CreatePesajeDto[];
}
