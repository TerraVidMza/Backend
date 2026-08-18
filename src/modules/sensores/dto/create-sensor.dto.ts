import { IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { SensorTipo } from '../entities/sensor.entity';

export class CreateSensorDto {
  @IsUUID()
  fincaId: string;

  @IsString()
  @Length(2, 50)
  codigo: string;

  @IsEnum(SensorTipo)
  tipo: SensorTipo;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  descripcion?: string;
}
