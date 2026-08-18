import { IsNumber, IsOptional } from 'class-validator';

export class SetUmbralDto {
  @IsOptional()
  @IsNumber()
  umbralMinimo?: number;

  @IsOptional()
  @IsNumber()
  umbralMaximo?: number;
}
