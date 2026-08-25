import { IsDateString, IsNumber, IsPositive } from 'class-validator';
import { EsFechaNoRetroactiva } from '../../../common/validators/no-retroactivo.validator';

export class SetCostoLaborDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  costoUnitario: number;

  @IsDateString()
  @EsFechaNoRetroactiva()
  validFrom: string;
}
