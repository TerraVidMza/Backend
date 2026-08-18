import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateRegistroLaborDto } from './create-registro-labor.dto';

export class SyncRegistroLaborDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateRegistroLaborDto)
  registros: CreateRegistroLaborDto[];
}
