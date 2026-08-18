import { IsDateString, IsNumber, Min } from 'class-validator';

export class SetCostoInsumoDto {
  @IsNumber()
  @Min(0)
  costoUnitario: number;

  @IsDateString()
  validFrom: string;
}
