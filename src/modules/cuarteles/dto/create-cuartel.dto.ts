import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class CreateCuartelDto {
  @IsUUID()
  fincaId: string;

  @IsUUID()
  variedadId: string;

  @IsUUID()
  sistemaConduccionId: string;

  @IsString()
  @Length(1, 100)
  nombre: string;

  @IsOptional()
  @IsString()
  @Length(0, 50)
  clon?: string;

  @IsOptional()
  @IsInt()
  anioImplantacion?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hectareas?: number;
}
