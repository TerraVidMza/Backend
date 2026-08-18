import { IsDateString, IsNumber, Min } from 'class-validator';

export class SetTarifaDto {
  @IsNumber()
  @Min(0)
  tarifaPorKg: number;

  @IsDateString()
  validFrom: string;
}
