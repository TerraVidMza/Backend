import { IsString } from 'class-validator';
import { EsPasswordSegura } from '../../../common/validators/password-segura.validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @EsPasswordSegura()
  newPassword: string;
}
