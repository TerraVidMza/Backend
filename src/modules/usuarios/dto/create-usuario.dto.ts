import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateUsuarioDto {
  @IsString()
  @MinLength(2)
  nombre: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsUUID()
  empresaId: string;

  @IsUUID()
  rolId: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
