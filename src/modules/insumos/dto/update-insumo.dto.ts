import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateInsumoDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  nombre?: string;

  @IsOptional()
  @IsString()
  @Length(0, 300)
  descripcion?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  unidadMedida?: string;
}
