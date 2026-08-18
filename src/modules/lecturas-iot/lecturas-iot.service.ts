import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LecturaIot } from './entities/lectura-iot.entity';
import { IngestLecturaDto } from './dto/ingest-lectura.dto';
import { SensoresService } from '../sensores/sensores.service';
import { UmbralSensorService } from '../umbral-sensor/umbral-sensor.service';
import { AlertasIotService } from '../alertas-iot/alertas-iot.service';
import { TipoAlerta } from '../alertas-iot/entities/alerta-iot.entity';

@Injectable()
export class LecturasIotService {
  constructor(
    @InjectRepository(LecturaIot)
    private readonly lecturaRepository: Repository<LecturaIot>,
    private readonly sensoresService: SensoresService,
    private readonly umbralSensorService: UmbralSensorService,
    private readonly alertasIotService: AlertasIotService,
  ) {}

  findBySensor(sensorId: string, limit = 100): Promise<LecturaIot[]> {
    return this.lecturaRepository.find({
      where: { sensorId },
      order: { sensorTimestamp: 'DESC' },
      take: limit,
    });
  }

  async ingest(dto: IngestLecturaDto): Promise<LecturaIot> {
    await this.sensoresService.findById(dto.sensorId);

    const lectura = this.lecturaRepository.create({
      sensorId: dto.sensorId,
      valor: dto.valor,
      unidad: dto.unidad,
      sensorTimestamp: new Date(dto.sensorTimestamp),
    });
    const guardada = await this.lecturaRepository.save(lectura);

    await this.evaluarUmbral(dto.sensorId, dto.valor, guardada.sensorTimestamp);

    return guardada;
  }

  private async evaluarUmbral(sensorId: string, valor: number, timestamp: Date): Promise<void> {
    const umbral = await this.umbralSensorService.findBySensor(sensorId);
    if (!umbral) {
      return;
    }

    if (umbral.umbralMinimo !== null && valor < Number(umbral.umbralMinimo)) {
      await this.alertasIotService.generarAlerta({
        sensorId,
        tipoAlerta: TipoAlerta.UMBRAL_MINIMO,
        valorLectura: valor,
        umbralSuperado: Number(umbral.umbralMinimo),
        timestampLectura: timestamp,
      });
      return;
    }

    if (umbral.umbralMaximo !== null && valor > Number(umbral.umbralMaximo)) {
      await this.alertasIotService.generarAlerta({
        sensorId,
        tipoAlerta: TipoAlerta.UMBRAL_MAXIMO,
        valorLectura: valor,
        umbralSuperado: Number(umbral.umbralMaximo),
        timestampLectura: timestamp,
      });
    }
  }
}
