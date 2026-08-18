import { IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateInsumoDto {
  @IsString()
  @Length(2, 100)
  nombre: string;

  @IsOptional()
  @IsString()
  @Length(0, 300)
  descripcion?: string;

  @IsString()
  @Length(1, 20)
  unidadMedida: string;

  @IsNumber()
  @Min(0)
  costoUnitarioInicial: number;
}
