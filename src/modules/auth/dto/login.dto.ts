import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export const CLIENTES = ['web', 'movil'] as const;
export type Cliente = (typeof CLIENTES)[number];

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;

  /**
   * Desde dónde se inicia sesión. Con `movil` el backend exige el permiso
   * `appMovil` (D-024). Opcional para no romper clientes que no lo mandan.
   */
  @IsOptional()
  @IsIn(CLIENTES)
  cliente?: Cliente;
}
