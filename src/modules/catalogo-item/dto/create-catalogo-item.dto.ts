import { IsEnum, IsString, Length } from 'class-validator';
import { CatalogoTipo } from '../entities/catalogo-item.entity';

export class CreateCatalogoItemDto {
  @IsEnum(CatalogoTipo)
  tipo: CatalogoTipo;

  @IsString()
  @Length(2, 100)
  nombre: string;
}
