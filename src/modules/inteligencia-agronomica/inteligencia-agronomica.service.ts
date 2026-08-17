import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Cuartel } from '../cuarteles/entities/cuartel.entity';
import { Sensor } from '../sensores/entities/sensor.entity';
import { LecturaIot } from '../lecturas-iot/entities/lectura-iot.entity';
import { AlertaIot } from '../alertas-iot/entities/alerta-iot.entity';
import { RegistroLabor } from '../registro-labor/entities/registro-labor.entity';
import { DetalleInsumoLabor } from '../registro-labor/entities/detalle-insumo-labor.entity';
import { PesajeVendimia } from '../pesaje-vendimia/entities/pesaje-vendimia.entity';

export interface SerieDiaria {
  fecha: string;
  valor: number;
}

@Injectable()
export class InteligenciaAgronomicaService {
  constructor(
    @InjectRepository(Cuartel) private readonly cuartelRepository: Repository<Cuartel>,
    @InjectRepository(Sensor) private readonly sensorRepository: Repository<Sensor>,
    @InjectRepository(LecturaIot) private readonly lecturaRepository: Repository<LecturaIot>,
    @InjectRepository(AlertaIot) private readonly alertaRepository: Repository<AlertaIot>,
    @InjectRepository(RegistroLabor) private readonly registroLaborRepository: Repository<RegistroLabor>,
    @InjectRepository(DetalleInsumoLabor)
    private readonly detalleInsumoLaborRepository: Repository<DetalleInsumoLabor>,
    @InjectRepository(PesajeVendimia) private readonly pesajeRepository: Repository<PesajeVendimia>,
  ) {}

  async correlacionSensorCostos(cuartelId: string, sensorId: string, desde: string, hasta: string) {
    const cuartel = await this.cuartelRepository.findOne({ where: { id: cuartelId } });
    if (!cuartel) {
      throw new NotFoundException('Cuartel no encontrado');
    }
    const sensor = await this.sensorRepository.findOne({ where: { id: sensorId } });
    if (!sensor) {
      throw new NotFoundException('Sensor no encontrado');
    }

    const serieSensor = await this.getSerieDiariaSensor(sensorId, desde, hasta);
    const serieCosto = await this.getSerieDiariaCosto(cuartelId, desde, hasta);

    const fechasComunes = serieSensor
      .map((s) => s.fecha)
      .filter((fecha) => serieCosto.some((c) => c.fecha === fecha));

    const valoresSensor = fechasComunes.map((f) => serieSensor.find((s) => s.fecha === f)!.valor);
    const valoresCosto = fechasComunes.map((f) => serieCosto.find((c) => c.fecha === f)!.valor);

    const coeficienteCorrelacion = this.pearson(valoresSensor, valoresCosto);

    return {
      sensor: { id: sensor.id, codigo: sensor.codigo, tipo: sensor.tipo },
      serieSensor,
      serieCosto,
      diasConDatosEnComun: fechasComunes.length,
      coeficienteCorrelacion,
    };
  }

  async getRecomendaciones(cuartelId: string): Promise<{ tipo: string; severidad: string; mensaje: string }[]> {
    const cuartel = await this.cuartelRepository.findOne({ where: { id: cuartelId } });
    if (!cuartel) {
      throw new NotFoundException('Cuartel no encontrado');
    }

    const recomendaciones: { tipo: string; severidad: string; mensaje: string }[] = [];

    const sensoresFinca = await this.sensorRepository.find({ where: { fincaId: cuartel.fincaId, activo: true } });
    const sensorIds = sensoresFinca.map((s) => s.id);

    if (sensorIds.length > 0) {
      const hace7Dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const alertasRecientes = await this.alertaRepository
        .createQueryBuilder('a')
        .where('a.sensor_id IN (:...sensorIds)', { sensorIds })
        .andWhere('a.created_at >= :desde', { desde: hace7Dias })
        .getMany();

      if (alertasRecientes.length >= 3) {
        recomendaciones.push({
          tipo: 'alerta_iot_recurrente',
          severidad: 'alta',
          mensaje: `Se registraron ${alertasRecientes.length} alertas de sensores en los últimos 7 días. Se recomienda inspeccionar el cuartel y revisar riego/protección según el tipo de sensor afectado.`,
        });
      }
    }

    const hace14Dias = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const labores = await this.registroLaborRepository
      .createQueryBuilder('r')
      .where('r.cuartel_id = :cuartelId', { cuartelId })
      .andWhere('r.fecha >= :desde', { desde: hace14Dias.toISOString().slice(0, 10) })
      .getCount();

    if (labores === 0) {
      recomendaciones.push({
        tipo: 'sin_labores_recientes',
        severidad: 'media',
        mensaje: 'No se registraron labores en este cuartel durante los últimos 14 días. Verificar si corresponde planificar una labor de mantenimiento.',
      });
    }

    if (recomendaciones.length === 0) {
      recomendaciones.push({
        tipo: 'sin_novedades',
        severidad: 'baja',
        mensaje: 'No se detectaron novedades relevantes para este cuartel en el período reciente.',
      });
    }

    return recomendaciones;
  }

  async compararCampanias(
    cuartelId: string,
    desde1: string,
    hasta1: string,
    desde2: string,
    hasta2: string,
  ) {
    const cuartel = await this.cuartelRepository.findOne({ where: { id: cuartelId } });
    if (!cuartel) {
      throw new NotFoundException('Cuartel no encontrado');
    }

    const [periodo1, periodo2] = await Promise.all([
      this.getIndicadoresPeriodo(cuartelId, desde1, hasta1),
      this.getIndicadoresPeriodo(cuartelId, desde2, hasta2),
    ]);

    return {
      periodo1: { desde: desde1, hasta: hasta1, ...periodo1 },
      periodo2: { desde: desde2, hasta: hasta2, ...periodo2 },
      variacionKgCosechados: this.variacionPorcentual(periodo1.kgCosechados, periodo2.kgCosechados),
      variacionCostoTotal: this.variacionPorcentual(periodo1.costoTotal, periodo2.costoTotal),
      variacionMargenBruto: this.variacionPorcentual(periodo1.margenBruto, periodo2.margenBruto),
    };
  }

  private async getIndicadoresPeriodo(cuartelId: string, desde: string, hasta: string) {
    const registros = await this.registroLaborRepository.find({
      where: { cuartelId, fecha: Between(desde, hasta) },
    });
    const costoLabores = registros.reduce(
      (acc, r) => acc + Number(r.cantidad) * Number(r.costoUnitarioAlSync ?? 0),
      0,
    );

    const registroIds = registros.map((r) => r.id);
    let costoInsumos = 0;
    if (registroIds.length > 0) {
      const detalles = await this.detalleInsumoLaborRepository
        .createQueryBuilder('d')
        .where('d.registro_labor_id IN (:...ids)', { ids: registroIds })
        .getMany();
      costoInsumos = detalles.reduce(
        (acc, d) => acc + Number(d.cantidadUsada) * Number(d.costoUnitarioAlSync ?? 0),
        0,
      );
    }

    const pesajes = await this.pesajeRepository.find({ where: { cuartelId, fecha: Between(desde, hasta) } });
    const kgCosechados = pesajes.reduce((acc, p) => acc + Number(p.kgTotales), 0);
    const ingresoLiquidacion = pesajes.reduce((acc, p) => acc + Number(p.montoLiquidacion ?? 0), 0);

    const costoTotal = costoLabores + costoInsumos;

    return {
      kgCosechados,
      costoLabores,
      costoInsumos,
      costoTotal,
      ingresoLiquidacion,
      margenBruto: ingresoLiquidacion - costoTotal,
    };
  }

  private async getSerieDiariaSensor(sensorId: string, desde: string, hasta: string): Promise<SerieDiaria[]> {
    const rows = await this.lecturaRepository
      .createQueryBuilder('l')
      .select("to_char(l.sensor_timestamp, 'YYYY-MM-DD')", 'fecha')
      .addSelect('AVG(l.valor)', 'valor')
      .where('l.sensor_id = :sensorId', { sensorId })
      .andWhere('l.sensor_timestamp BETWEEN :desde AND :hasta', { desde, hasta: `${hasta} 23:59:59` })
      .groupBy("to_char(l.sensor_timestamp, 'YYYY-MM-DD')")
      .orderBy('fecha', 'ASC')
      .getRawMany<{ fecha: string; valor: string }>();

    return rows.map((r) => ({ fecha: r.fecha, valor: Number(r.valor) }));
  }

  private async getSerieDiariaCosto(cuartelId: string, desde: string, hasta: string): Promise<SerieDiaria[]> {
    const registros = await this.registroLaborRepository.find({
      where: { cuartelId, fecha: Between(desde, hasta) },
    });

    const normalizarFecha = (fecha: string | Date): string =>
      fecha instanceof Date ? fecha.toISOString().slice(0, 10) : String(fecha).slice(0, 10);

    const costoPorFecha = new Map<string, number>();
    for (const registro of registros) {
      const fecha = normalizarFecha(registro.fecha);
      const costoLabor = Number(registro.cantidad) * Number(registro.costoUnitarioAlSync ?? 0);
      costoPorFecha.set(fecha, (costoPorFecha.get(fecha) ?? 0) + costoLabor);
    }

    const registroIds = registros.map((r) => r.id);
    if (registroIds.length > 0) {
      const detalles = await this.detalleInsumoLaborRepository
        .createQueryBuilder('d')
        .innerJoin('d.registroLabor', 'r')
        .addSelect('r.fecha', 'fecha')
        .where('d.registro_labor_id IN (:...ids)', { ids: registroIds })
        .getRawAndEntities();

      detalles.entities.forEach((detalle, index) => {
        const fecha = normalizarFecha(detalles.raw[index].fecha as string | Date);
        const costoInsumo = Number(detalle.cantidadUsada) * Number(detalle.costoUnitarioAlSync ?? 0);
        costoPorFecha.set(fecha, (costoPorFecha.get(fecha) ?? 0) + costoInsumo);
      });
    }

    return Array.from(costoPorFecha.entries())
      .map(([fecha, valor]) => ({ fecha, valor }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  private pearson(x: number[], y: number[]): number | null {
    const n = x.length;
    if (n < 2) {
      return null;
    }

    const mediaX = x.reduce((a, b) => a + b, 0) / n;
    const mediaY = y.reduce((a, b) => a + b, 0) / n;

    let numerador = 0;
    let sumaCuadX = 0;
    let sumaCuadY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - mediaX;
      const dy = y[i] - mediaY;
      numerador += dx * dy;
      sumaCuadX += dx * dx;
      sumaCuadY += dy * dy;
    }

    const denominador = Math.sqrt(sumaCuadX * sumaCuadY);
    if (denominador === 0) {
      return null;
    }

    return Number((numerador / denominador).toFixed(4));
  }

  private variacionPorcentual(anterior: number, actual: number): number | null {
    if (anterior === 0) {
      return null;
    }
    return Number((((actual - anterior) / anterior) * 100).toFixed(2));
  }
}
