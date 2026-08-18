import { IsEnum, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';
import { ModuloAyuda, TipoArticulo } from '../entities/articulo-ayuda.entity';

export class CreateArticuloDto {
  @IsEnum(TipoArticulo)
  tipo: TipoArticulo;

  @IsEnum(ModuloAyuda)
  modulo: ModuloAyuda;

  @IsString()
  @Length(2, 200)
  titulo: string;

  @IsString()
  contenido: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;
}
