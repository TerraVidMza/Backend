import { IsString, Length } from 'class-validator';

export class SetConfiguracionDto {
  @IsString()
  @Length(1, 100)
  clave: string;

  @IsString()
  valor: string;
}
