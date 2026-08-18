import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateSensorDto {
  @IsOptional()
  @IsString()
  @Length(2, 50)
  codigo?: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  descripcion?: string;
}
