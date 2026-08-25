import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UmbralSensor } from './entities/umbral-sensor.entity';
import { SetUmbralDto } from './dto/set-umbral.dto';
import { LecturaIot } from '../lecturas-iot/entities/lectura-iot.entity';
import { RANGOS_FISICOS } from '../lecturas-iot/rangos-fisicos';

@Injectable()
export class UmbralSensorService {
  constructor(
    @InjectRepository(UmbralSensor)
    private readonly umbralRepository: Repository<UmbralSensor>,
    @InjectRepository(LecturaIot)
    private readonly lecturaRepository: Repository<LecturaIot>,
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
  ): Promise<{ umbral: UmbralSensor; aviso: string | null }> {
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
    const guardado = await this.umbralRepository.save(umbral);

    return { umbral: guardado, aviso: await this.avisarSiYaSupera(guardado) };
  }

  /**
   * Aviso de HU-21: la última lectura ya está fuera del umbral recién guardado.
   *
   * Es informativo y **no genera alerta**: las alertas las produce la ingesta al
   * evaluar lecturas nuevas (HU-22). Sin este aviso, configurar un umbral que ya
   * está superado no daba ninguna señal hasta que llegara la siguiente lectura,
   * que en un sensor horario puede tardar una hora.
   *
   * El mensaje lo arma el backend para que la pantalla no tenga que duplicar la
   * comparación ni la unidad.
   */
  private async avisarSiYaSupera(umbral: UmbralSensor): Promise<string | null> {
    if (umbral.umbralMinimo === null && umbral.umbralMaximo === null) {
      return null;
    }

    const ultima = await this.lecturaRepository.findOne({
      where: { sensorId: umbral.sensorId },
      order: { sensorTimestamp: 'DESC' },
      relations: { sensor: true },
    });
    if (!ultima) return null;

    const valor = Number(ultima.valor);
    // La unidad sale del tipo de variable y no del sensor: `sensores` no la
    // guarda, y es la misma para todos los nodos que miden lo mismo.
    const unidad = ultima.sensor
      ? (RANGOS_FISICOS[ultima.sensor.tipo]?.unidadEsperada ?? '')
      : '';
    const formatear = (n: number) => `${n} ${unidad}`.trim();

    if (umbral.umbralMaximo !== null && valor > Number(umbral.umbralMaximo)) {
      return `La última lectura del sensor (${formatear(valor)}) ya supera el umbral máximo que configuraste (${formatear(Number(umbral.umbralMaximo))}).`;
    }
    if (umbral.umbralMinimo !== null && valor < Number(umbral.umbralMinimo)) {
      return `La última lectura del sensor (${formatear(valor)}) ya está por debajo del umbral mínimo que configuraste (${formatear(Number(umbral.umbralMinimo))}).`;
    }
    return null;
  }
}
