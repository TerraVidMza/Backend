import { IsString, Length } from 'class-validator';

export class RechazarRemitoDto {
  @IsString()
  @Length(2, 500)
  motivoRechazo: string;
}
