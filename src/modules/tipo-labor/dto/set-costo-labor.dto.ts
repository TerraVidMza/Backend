import { IsDateString, IsNumber, Min } from 'class-validator';

export class SetCostoLaborDto {
  @IsNumber()
  @Min(0)
  costoUnitario: number;

  @IsDateString()
  validFrom: string;
}
