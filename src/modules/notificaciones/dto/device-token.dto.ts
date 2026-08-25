import { IsEnum, IsString, Length } from 'class-validator';
import { PlataformaDispositivo } from '../entities/device-token.entity';

export class RegistrarDeviceTokenDto {
  /**
   * El registration token de FCM no tiene largo fijo ni formato documentado, y
   * cambió de tamaño entre versiones del SDK. El rango es amplio a propósito:
   * validar un formato exacto rompería con la próxima rotación de Firebase.
   */
  @IsString()
  @Length(20, 512)
  token: string;

  @IsEnum(PlataformaDispositivo)
  plataforma: PlataformaDispositivo;
}

export class BajaDeviceTokenDto {
  @IsString()
  @Length(20, 512)
  token: string;
}
