import { IsDateString, IsNumber, IsString, IsUUID, Length } from 'class-validator';

export class IngestLecturaDto {
  @IsUUID()
  sensorId: string;

  @IsNumber()
  valor: number;

  @IsString()
  @Length(1, 20)
  unidad: string;

  @IsDateString()
  sensorTimestamp: string;
}
