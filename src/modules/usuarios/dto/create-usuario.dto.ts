import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { EsPasswordSegura } from '../../../common/validators/password-segura.validator';

export class CreateUsuarioDto {
  @IsString()
  @Length(2, 100)
  nombre: string;

  @IsEmail()
  email: string;

  /**
   * Opcional (HU-05): omitirla genera una contraseña temporal y dispara el
   * email de bienvenida con un enlace de 48 horas. Es el camino recomendado —
   * así el Propietario nunca conoce la contraseña de otro usuario.
   */
  @IsOptional()
  @EsPasswordSegura()
  password?: string;

  @IsUUID()
  rolId: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
