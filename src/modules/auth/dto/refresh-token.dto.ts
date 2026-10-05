import { IsString, Length } from 'class-validator';

export class RefreshTokenDto {
  /** Valor opaco entregado en el login o en la última renovación (D-023). */
  @IsString()
  @Length(20, 200)
  refreshToken: string;
}
