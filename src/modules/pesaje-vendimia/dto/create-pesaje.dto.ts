import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
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

  /**
   * Dónde se registró, si el teléfono tenía GPS (D-027). Opcionales: sin
   * permiso de ubicación o sin señal el registro se guarda igual.
   */
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitud?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitud?: number;
}
