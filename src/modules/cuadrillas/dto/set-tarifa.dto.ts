import { IsDateString, IsNumber, IsPositive } from 'class-validator';
import { EsFechaNoRetroactiva } from '../../../common/validators/no-retroactivo.validator';

export class SetTarifaDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  tarifaPorKg: number;

  @IsDateString()
  @EsFechaNoRetroactiva()
  validFrom: string;
}
