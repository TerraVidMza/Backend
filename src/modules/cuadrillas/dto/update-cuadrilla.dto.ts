import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class UpdateCuadrillaDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  nombre?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  cantidadIntegrantes?: number;
}
