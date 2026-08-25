import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class CreatePesajeDto {
  @IsUUID()
  localUuid: string;

  @IsUUID()
  cuadrillaId: string;

  @IsUUID()
  cuartelId: string;

  @IsDateString()
  fecha: string;

  @IsNumber()
  @Min(0.01)
  kgTotales: number;

  /**
   * Momento de creación en el dispositivo (HU-14). Opcional para no romper a
   * los clientes que todavía no lo mandan; sin él se usa la hora del servidor.
   */
  @IsOptional()
  @IsDateString()
  createdAtLocal?: string;
}
