import { IsNumber, IsUUID, Min } from 'class-validator';

export class DetalleInsumoDto {
  @IsUUID()
  insumoId: string;

  @IsNumber()
  @Min(0.0001)
  cantidadUsada: number;
}
