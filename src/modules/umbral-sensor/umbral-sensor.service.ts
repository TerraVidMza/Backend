import { BadRequestException, Injectable } from '@nestjs/common';
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

  /**
   * Configura los umbrales de un sensor (HU-21).
   *
   * Un campo ausente conserva su valor; un campo enviado en `null` lo borra.
   * Antes se usaba `dto.umbralMinimo ?? umbral.umbralMinimo ?? null`, y como
   * `??` trata `null` igual que `undefined`, el valor anterior se conservaba
   * siempre: era imposible eliminar un umbral ya configurado desde la API.
   *
   * La distinción se hace contra `undefined` y **no** con el operador `in`:
   * con `target: ES2023` los campos declarados de la clase se emiten como
   * propiedades propias, así que `plainToInstance` deja `umbralMaximo` en el
   * DTO aunque el cliente no lo haya mandado. Con `in`, omitir un umbral lo
   * borraba igual que enviarlo en `null`.
   */
  async setUmbral(
    sensorId: string,
    dto: SetUmbralDto,
    configuradoPorId: string,
  ): Promise<UmbralSensor> {
    let umbral = await this.umbralRepository.findOne({ where: { sensorId } });
    if (!umbral) {
      umbral = this.umbralRepository.create({ sensorId, configuradoPorId });
    }

    if (dto.umbralMinimo !== undefined) {
      umbral.umbralMinimo = dto.umbralMinimo;
    }
    if (dto.umbralMaximo !== undefined) {
      umbral.umbralMaximo = dto.umbralMaximo;
    }

    if (
      umbral.umbralMinimo !== null &&
      umbral.umbralMaximo !== null &&
      Number(umbral.umbralMinimo) >= Number(umbral.umbralMaximo)
    ) {
      throw new BadRequestException(
        'El umbral mínimo debe ser menor que el máximo.',
      );
    }

    umbral.configuradoPorId = configuradoPorId;
    return this.umbralRepository.save(umbral);
  }
}
