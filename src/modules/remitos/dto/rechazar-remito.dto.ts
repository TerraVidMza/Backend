import { IsString, Length } from 'class-validator';

export class RechazarRemitoDto {
  // Mínimo 10 caracteres (HU-27): el motivo llega al Capataz como única
  // explicación del rechazo, así que un "no" no alcanza.
  @IsString()
  @Length(10, 500)
  motivoRechazo: string;
}
