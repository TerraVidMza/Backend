import { IsString } from 'class-validator';
import { EsPasswordSegura } from '../../../common/validators/password-segura.validator';

export class ResetPasswordDto {
  @IsString()
  token: string;

  @EsPasswordSegura()
  newPassword: string;
}
