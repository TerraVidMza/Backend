import { IsInt, IsNumber, IsString, IsUUID, Length, Min } from 'class-validator';

export class CreateCuadrillaDto {
  @IsUUID()
  fincaId: string;

  @IsString()
  @Length(2, 100)
  nombre: string;

  @IsInt()
  @Min(1)
  cantidadIntegrantes: number;

  @IsNumber()
  @Min(0)
  tarifaPorKgInicial: number;
}
