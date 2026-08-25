import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class CreateCuadrillaDto {
  @IsUUID()
  fincaId: string;

  @IsString()
  @Length(2, 100)
  nombre: string;

  @IsInt()
  @Min(1)
  cantidadIntegrantes: number;

  /**
   * Opcional porque un Capataz puede dar de alta la cuadrilla sin tarifa
   * (HU-23): el Propietario la asigna después. El service ignora este campo
   * cuando el rol del solicitante no es Propietario, así que enviarlo por
   * manipulación del request no tiene efecto.
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  tarifaPorKgInicial?: number;
}
