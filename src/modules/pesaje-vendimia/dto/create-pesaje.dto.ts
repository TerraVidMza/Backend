import { IsDateString, IsNumber, IsUUID, Min } from 'class-validator';

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
}
