import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { ModuloAyuda } from '../entities/articulo-ayuda.entity';

export class CrearTicketDto {
  @IsEnum(ModuloAyuda)
  modulo: ModuloAyuda;

  @IsString()
  @Length(10, 1000)
  descripcion: string;

  @IsOptional()
  @IsString()
  @Length(0, 30)
  appVersion?: string;
}
