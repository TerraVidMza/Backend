import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Finca } from '../fincas/entities/finca.entity';
import { Cuartel } from '../cuarteles/entities/cuartel.entity';
import { AlertaIot, EstadoAlerta } from '../alertas-iot/entities/alerta-iot.entity';
import { RegistroLabor } from '../registro-labor/entities/registro-labor.entity';
import { DetalleInsumoLabor } from '../registro-labor/entities/detalle-insumo-labor.entity';
import { PesajeVendimia } from '../pesaje-vendimia/entities/pesaje-vendimia.entity';
import { Remito, EstadoRemito } from '../remitos/entities/remito.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Finca) private readonly fincaRepository: Repository<Finca>,
    @InjectRepository(Cuartel) private readonly cuartelRepository: Repository<Cuartel>,
    @InjectRepository(AlertaIot) private readonly alertaRepository: Repository<AlertaIot>,
    @InjectRepository(RegistroLabor) private readonly registroLaborRepository: Repository<RegistroLabor>,
    @InjectRepository(DetalleInsumoLabor)
    private readonly detalleInsumoLaborRepository: Repository<DetalleInsumoLabor>,
    @InjectRepository(PesajeVendimia) private readonly pesajeRepository: Repository<PesajeVendimia>,
    @InjectRepository(Remito) private readonly remitoRepository: Repository<Remito>,
  ) {}

  async getIndicadoresClave(empresaId: string): Promise<{
    fincasActivas: number;
    cuartelesActivos: number;
    alertasIotPendientes: number;
    remitosPendientesAprobacion: number;
    kgCosechadosCampaniaActual: number;
    costoLaboresTotal: number;
    costoInsumosTotal: number;
  }> {
    const fincaIds = (await this.fincaRepository.find({ where: { empresaId, activa: true } })).map((f) => f.id);

    const fincasActivas = fincaIds.length;

    if (fincasActivas === 0) {
      return {
        fincasActivas: 0,
        cuartelesActivos: 0,
        alertasIotPendientes: 0,
        remitosPendientesAprobacion: 0,
        kgCosechadosCampaniaActual: 0,
        costoLaboresTotal: 0,
        costoInsumosTotal: 0,
      };
    }

    const cuartelesActivos = await this.cuartelRepository
      .createQueryBuilder('c')
      .where('c.finca_id IN (:...fincaIds)', { fincaIds })
      .andWhere('c.activo = true')
      .getCount();

    const cuartelIds = (
      await this.cuartelRepository.createQueryBuilder('c').where('c.finca_id IN (:...fincaIds)', { fincaIds }).getMany()
    ).map((c) => c.id);

    if (cuartelIds.length === 0) {
      return {
        fincasActivas,
        cuartelesActivos: 0,
        alertasIotPendientes: 0,
        remitosPendientesAprobacion: 0,
        kgCosechadosCampaniaActual: 0,
        costoLaboresTotal: 0,
        costoInsumosTotal: 0,
      };
    }

    const alertasIotPendientes = await this.alertaRepository
      .createQueryBuilder('a')
      .innerJoin('a.sensor', 's')
      .where('s.finca_id IN (:...fincaIds)', { fincaIds })
      .andWhere('a.estado = :estado', { estado: EstadoAlerta.PENDIENTE })
      .getCount();

    const remitosPendientesAprobacion = await this.remitoRepository
      .createQueryBuilder('r')
      .where('r.cuartel_id IN (:...cuartelIds)', { cuartelIds })
      .andWhere('r.estado = :estado', { estado: EstadoRemito.BORRADOR })
      .getCount();

    const anioActual = new Date().getFullYear();
    const { sum: kgCosechados } = await this.pesajeRepository
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.kg_totales), 0)', 'sum')
      .where('p.cuartel_id IN (:...cuartelIds)', { cuartelIds })
      .andWhere('EXTRACT(YEAR FROM p.fecha) = :anio', { anio: anioActual })
      .getRawOne();

    const registros = await this.registroLaborRepository
      .createQueryBuilder('r')
      .where('r.cuartel_id IN (:...cuartelIds)', { cuartelIds })
      .getMany();

    const costoLaboresTotal = registros.reduce(
      (acc, r) => acc + Number(r.cantidad) * Number(r.costoUnitarioAlSync ?? 0),
      0,
    );

    const registroIds = registros.map((r) => r.id);
    let costoInsumosTotal = 0;
    if (registroIds.length > 0) {
      const detalles = await this.detalleInsumoLaborRepository
        .createQueryBuilder('d')
        .where('d.registro_labor_id IN (:...ids)', { ids: registroIds })
        .getMany();
      costoInsumosTotal = detalles.reduce(
        (acc, d) => acc + Number(d.cantidadUsada) * Number(d.costoUnitarioAlSync ?? 0),
        0,
      );
    }

    return {
      fincasActivas,
      cuartelesActivos,
      alertasIotPendientes,
      remitosPendientesAprobacion,
      kgCosechadosCampaniaActual: Number(kgCosechados ?? 0),
      costoLaboresTotal,
      costoInsumosTotal,
    };
  }
}
