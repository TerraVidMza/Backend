import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { UnidadMedida } from '../../../common/enums/unidad-medida.enum';

export class CreateInsumoDto {
  @IsString()
  @Length(2, 100)
  nombre: string;

  @IsOptional()
  @IsString()
  @Length(0, 300)
  descripcion?: string;

  /**
   * Conjunto cerrado (HU-16): como texto libre convivían "kg", "Kg" y
   * "kilos" como unidades distintas, y toda agregación las separaba.
   */
  @IsEnum(UnidadMedida)
  unidadMedida: UnidadMedida;

  @IsNumber()
  @Min(0)
  costoUnitarioInicial: number;
}
