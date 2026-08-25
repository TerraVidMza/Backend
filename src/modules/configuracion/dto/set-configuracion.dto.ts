import { IsIn, IsString } from 'class-validator';
import {
  CLAVES_CONFIGURACION,
  type ClaveConfiguracion,
} from '../configuracion.keys';

export class SetConfiguracionDto {
  @IsIn(CLAVES_CONFIGURACION as readonly string[])
  clave: ClaveConfiguracion;

  @IsString()
  valor: string;
}
