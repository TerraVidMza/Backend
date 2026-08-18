import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sensor } from './entities/sensor.entity';
import { CreateSensorDto } from './dto/create-sensor.dto';
import { UpdateSensorDto } from './dto/update-sensor.dto';

@Injectable()
export class SensoresService {
  constructor(
    @InjectRepository(Sensor)
    private readonly sensorRepository: Repository<Sensor>,
  ) {}

  findByFinca(fincaId: string): Promise<Sensor[]> {
    return this.sensorRepository.find({ where: { fincaId }, order: { codigo: 'ASC' } });
  }

  async findById(id: string): Promise<Sensor> {
    const sensor = await this.sensorRepository.findOne({ where: { id } });
    if (!sensor) {
      throw new NotFoundException('Sensor no encontrado');
    }
    return sensor;
  }

  async create(dto: CreateSensorDto): Promise<Sensor> {
    const existente = await this.sensorRepository.findOne({ where: { codigo: dto.codigo } });
    if (existente) {
      throw new BadRequestException('Ya existe un sensor con ese código');
    }
    const sensor = this.sensorRepository.create({ ...dto, activo: true });
    return this.sensorRepository.save(sensor);
  }

  async update(id: string, dto: UpdateSensorDto): Promise<Sensor> {
    const sensor = await this.findById(id);
    Object.assign(sensor, dto);
    return this.sensorRepository.save(sensor);
  }

  async desactivar(id: string): Promise<Sensor> {
    const sensor = await this.findById(id);
    sensor.activo = false;
    return this.sensorRepository.save(sensor);
  }
}
