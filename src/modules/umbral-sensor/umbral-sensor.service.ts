import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UmbralSensor } from './entities/umbral-sensor.entity';
import { SetUmbralDto } from './dto/set-umbral.dto';

@Injectable()
export class UmbralSensorService {
  constructor(
    @InjectRepository(UmbralSensor)
    private readonly umbralRepository: Repository<UmbralSensor>,
  ) {}

  findBySensor(sensorId: string): Promise<UmbralSensor | null> {
    return this.umbralRepository.findOne({ where: { sensorId } });
  }

  async setUmbral(sensorId: string, dto: SetUmbralDto, configuradoPorId: string): Promise<UmbralSensor> {
    let umbral = await this.umbralRepository.findOne({ where: { sensorId } });
    if (!umbral) {
      umbral = this.umbralRepository.create({ sensorId, configuradoPorId });
    }
    umbral.umbralMinimo = dto.umbralMinimo ?? umbral.umbralMinimo ?? null;
    umbral.umbralMaximo = dto.umbralMaximo ?? umbral.umbralMaximo ?? null;
    umbral.configuradoPorId = configuradoPorId;
    return this.umbralRepository.save(umbral);
  }
}
