import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateIf,
} from 'class-validator';

/**
 * Payload de ingesta de telemetría (HU-19).
 *
 * El contrato es por **`codigoSensor`**, no por el UUID interno: el nodo ESP32
 * se aprovisiona con la etiqueta física del sensor y no tiene forma de conocer
 * un identificador que genera la base. Se sigue aceptando `sensorId` para no
 * romper a los dispositivos ya desplegados con el contrato anterior.
 */
export class IngestLecturaDto {
  @ValidateIf((dto: IngestLecturaDto) => !dto.sensorId)
  @IsString()
  @Length(2, 50)
  codigoSensor?: string;

  /** @deprecated Usar `codigoSensor`. Se mantiene por compatibilidad. */
  @IsOptional()
  @IsUUID()
  sensorId?: string;

  @IsNumber()
  valor: number;

  @IsString()
  @Length(1, 20)
  unidad: string;

  @IsDateString()
  sensorTimestamp: string;
}
