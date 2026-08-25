import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Finca } from '../fincas/entities/finca.entity';
import { Cuartel } from '../cuarteles/entities/cuartel.entity';
import {
  AlertaIot,
  EstadoAlerta,
} from '../alertas-iot/entities/alerta-iot.entity';
import { RegistroLabor } from '../registro-labor/entities/registro-labor.entity';
import { DetalleInsumoLabor } from '../registro-labor/entities/detalle-insumo-labor.entity';
import { PesajeVendimia } from '../pesaje-vendimia/entities/pesaje-vendimia.entity';
import { Remito, EstadoRemito } from '../remitos/entities/remito.entity';
import { LogAuditoriaService } from '../log-auditoria/log-auditoria.service';
import { LogAuditoria } from '../log-auditoria/entities/log-auditoria.entity';
import { RolNombre } from '../../common/enums/rol.enum';
import { EstadoSync } from '../../common/enums/estado-sync.enum';

/** Indicadores operativos, sin datos económicos. */
interface IndicadoresOperativos {
  fincasActivas: number;
  cuartelesActivos: number;
  alertasIotPendientes: number;
  remitosPendientesAprobacion: number;
  kgCosechadosCampaniaActual: number;
}

interface IndicadoresEconomicos {
  costoLaboresTotal: number;
  costoInsumosTotal: number;
}

/** Desglose que solo ven los roles con alcance económico (HU-32). */
interface DesgloseEconomico {
  costosPorFinca: Array<{
    fincaId: string;
    fincaNombre: string;
    costoTotal: number;
  }>;
  alertasRecientes: AlertaIot[];
  /** Registros de labor que quedaron en error de sincronización. */
  registrosConError: number;
}

export type IndicadoresClave =
  | ({
      rol: RolNombre.PROPIETARIO | RolNombre.AGRONOMO;
    } & IndicadoresOperativos &
      IndicadoresEconomicos &
      DesgloseEconomico)
  | ({ rol: RolNombre.CAPATAZ } & IndicadoresOperativos)
  | { rol: RolNombre.AUDITOR; eventosRecientes: LogAuditoria[] };

const OPERATIVOS_VACIOS: IndicadoresOperativos = {
  fincasActivas: 0,
  cuartelesActivos: 0,
  alertasIotPendientes: 0,
  remitosPendientesAprobacion: 0,
  kgCosechadosCampaniaActual: 0,
};

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Finca)
    private readonly fincaRepository: Repository<Finca>,
    @InjectRepository(Cuartel)
    private readonly cuartelRepository: Repository<Cuartel>,
    @InjectRepository(AlertaIot)
    private readonly alertaRepository: Repository<AlertaIot>,
    @InjectRepository(RegistroLabor)
    private readonly registroLaborRepository: Repository<RegistroLabor>,
    @InjectRepository(DetalleInsumoLabor)
    private readonly detalleInsumoLaborRepository: Repository<DetalleInsumoLabor>,
    @InjectRepository(PesajeVendimia)
    private readonly pesajeRepository: Repository<PesajeVendimia>,
    @InjectRepository(Remito)
    private readonly remitoRepository: Repository<Remito>,
    private readonly logAuditoriaService: LogAuditoriaService,
  ) {}

  /**
   * El contenido del dashboard depende del rol (HU-32).
   *
   * El Auditor tiene alcance reducido al log de auditoría y al historial por
   * cuartel: no debe recibir métricas de costos, sensores ni vendimia. Antes
   * este método devolvía el mismo payload a los cuatro roles, así que el
   * Auditor recibía los costos totales de la empresa.
   */
  async getIndicadoresClave(
    empresaId: string,
    rol: RolNombre,
  ): Promise<IndicadoresClave> {
    if (rol === RolNombre.AUDITOR) {
      return {
        rol: RolNombre.AUDITOR,
        eventosRecientes: await this.logAuditoriaService.findRecientes(
          empresaId,
          24,
          10,
        ),
      };
    }

    const operativos = await this.getOperativos(empresaId);

    if (rol === RolNombre.CAPATAZ) {
      return { rol: RolNombre.CAPATAZ, ...operativos };
    }

    const [economicos, costosPorFinca, alertasRecientes, registrosConError] =
      await Promise.all([
        this.getEconomicos(empresaId),
        this.getCostosPorFinca(empresaId),
        this.getAlertasRecientes(empresaId),
        this.getPendientesDeSync(empresaId),
      ]);

    return {
      rol,
      ...operativos,
      ...economicos,
      costosPorFinca,
      alertasRecientes,
      registrosConError,
    };
  }

  private async getFincaIds(empresaId: string): Promise<string[]> {
    const fincas = await this.fincaRepository.find({
      where: { empresaId, activa: true },
    });
    return fincas.map((f) => f.id);
  }

  private async getCuartelIds(fincaIds: string[]): Promise<string[]> {
    if (fincaIds.length === 0) return [];
    const cuarteles = await this.cuartelRepository
      .createQueryBuilder('c')
      .where('c.finca_id IN (:...fincaIds)', { fincaIds })
      .getMany();
    return cuarteles.map((c) => c.id);
  }

  private async getOperativos(
    empresaId: string,
  ): Promise<IndicadoresOperativos> {
    const fincaIds = await this.getFincaIds(empresaId);
    if (fincaIds.length === 0) {
      return OPERATIVOS_VACIOS;
    }

    const cuartelesActivos = await this.cuartelRepository
      .createQueryBuilder('c')
      .where('c.finca_id IN (:...fincaIds)', { fincaIds })
      .andWhere('c.activo = true')
      .getCount();

    const cuartelIds = await this.getCuartelIds(fincaIds);
    if (cuartelIds.length === 0) {
      return { ...OPERATIVOS_VACIOS, fincasActivas: fincaIds.length };
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
    const kgCosechados = (
      await this.pesajeRepository
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.kg_totales), 0)', 'sum')
        .where('p.cuartel_id IN (:...cuartelIds)', { cuartelIds })
        .andWhere('EXTRACT(YEAR FROM p.fecha) = :anio', { anio: anioActual })
        .getRawOne<{ sum: string }>()
    )?.sum;

    return {
      fincasActivas: fincaIds.length,
      cuartelesActivos,
      alertasIotPendientes,
      remitosPendientesAprobacion,
      kgCosechadosCampaniaActual: Number(kgCosechados ?? 0),
    };
  }

  /**
   * Costos acumulados de la empresa, agregados en SQL.
   *
   * La versión anterior traía a memoria **todos** los `RegistroLabor` y
   * `DetalleInsumoLabor` históricos de la empresa para sumarlos con
   * `Array.reduce`. Eso crece sin techo con el histórico y el dashboard es la
   * primera pantalla que se abre, contra un objetivo de P95 < 3 s.
   *
   * Los insumos van en su propia agregación: unirlos a las labores en una sola
   * consulta multiplica cada labor por su cantidad de insumos e infla el costo
   * de mano de obra.
   */
  private async getEconomicos(
    empresaId: string,
  ): Promise<IndicadoresEconomicos> {
    const filas = await this.registroLaborRepository.query<
      Array<{ costoLabores: string; costoInsumos: string }>
    >(
      `SELECT COALESCE((
                SELECT SUM(rl.cantidad * COALESCE(rl.costo_unitario_al_sync, 0))
                  FROM registro_labor rl
                  JOIN cuarteles c ON c.id = rl.cuartel_id
                  JOIN fincas f    ON f.id = c.finca_id
                 WHERE f.empresa_id = $1
                   AND rl.estado_sync = $2
              ), 0) AS "costoLabores",
              COALESCE((
                SELECT SUM(d.cantidad_usada * COALESCE(d.costo_unitario_al_sync, 0))
                  FROM detalle_insumo_labor d
                  JOIN registro_labor rl ON rl.id = d.registro_labor_id
                  JOIN cuarteles c ON c.id = rl.cuartel_id
                  JOIN fincas f    ON f.id = c.finca_id
                 WHERE f.empresa_id = $1
                   AND rl.estado_sync = $2
              ), 0) AS "costoInsumos"`,
      [empresaId, EstadoSync.SINCRONIZADO],
    );

    const fila = filas[0];
    return {
      costoLaboresTotal: Number(fila?.costoLabores ?? 0),
      costoInsumosTotal: Number(fila?.costoInsumos ?? 0),
    };
  }

  /**
   * Margen —hoy, costo— por finca, para el desglose del dashboard (HU-32).
   * Una sola consulta agrupada en vez de una por finca.
   */
  private async getCostosPorFinca(
    empresaId: string,
  ): Promise<
    Array<{ fincaId: string; fincaNombre: string; costoTotal: number }>
  > {
    const filas = await this.registroLaborRepository.query<
      Array<{ fincaId: string; fincaNombre: string; costoTotal: string }>
    >(
      `SELECT f.id     AS "fincaId",
              f.nombre AS "fincaNombre",
              COALESCE(SUM(rl.cantidad * COALESCE(rl.costo_unitario_al_sync, 0)), 0)
                       AS "costoTotal"
         FROM fincas f
         LEFT JOIN cuarteles c ON c.finca_id = f.id AND c.activo = true
         LEFT JOIN registro_labor rl
                ON rl.cuartel_id = c.id
               AND rl.estado_sync = $2
        WHERE f.empresa_id = $1
          AND f.activa = true
        GROUP BY f.id, f.nombre
        ORDER BY f.nombre`,
      [empresaId, EstadoSync.SINCRONIZADO],
    );

    return filas.map((f) => ({
      fincaId: f.fincaId,
      fincaNombre: f.fincaNombre,
      costoTotal: Number(f.costoTotal),
    }));
  }

  /** Las 3 alertas IoT más recientes sin revisar, para el panel de HU-32. */
  private async getAlertasRecientes(empresaId: string): Promise<AlertaIot[]> {
    return this.alertaRepository.find({
      where: {
        estado: EstadoAlerta.PENDIENTE,
        sensor: { finca: { empresaId } },
      },
      relations: { sensor: { finca: true } },
      order: { createdAt: 'DESC' },
      take: 3,
    });
  }

  /**
   * Registros que quedaron en error de sincronización (HU-32). Es el número que
   * le dice al Propietario que hay trabajo de campo que no llegó al sistema.
   */
  private async getPendientesDeSync(empresaId: string): Promise<number> {
    const filas = await this.registroLaborRepository.query<
      Array<{ total: string }>
    >(
      `SELECT COUNT(*) AS total
         FROM registro_labor rl
         JOIN cuarteles c ON c.id = rl.cuartel_id
         JOIN fincas f    ON f.id = c.finca_id
        WHERE f.empresa_id = $1
          AND rl.estado_sync = $2`,
      [empresaId, EstadoSync.ERROR],
    );
    return Number(filas[0]?.total ?? 0);
  }
}
