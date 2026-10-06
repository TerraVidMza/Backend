import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Finca } from '../fincas/entities/finca.entity';
import { Cuartel } from '../cuarteles/entities/cuartel.entity';
import {
  AlertaIot,
  EstadoAlerta,
} from '../alertas-iot/entities/alerta-iot.entity';
import { RegistroLabor } from '../registro-labor/entities/registro-labor.entity';
import { PesajeVendimia } from '../pesaje-vendimia/entities/pesaje-vendimia.entity';
import { Remito, EstadoRemito } from '../remitos/entities/remito.entity';
import { LogAuditoriaService } from '../log-auditoria/log-auditoria.service';
import { LogAuditoria } from '../log-auditoria/entities/log-auditoria.entity';
import { RolNombre } from '../../common/enums/rol.enum';
import { EstadoSync } from '../../common/enums/estado-sync.enum';
import { EstadoCuartel } from '../cuarteles/entities/estado-cuartel.enum';
import { UsuarioFinca } from '../usuarios/entities/usuario-finca.entity';
import { CampaniasService } from '../campanias/campanias.service';

/** Reparto de cuarteles por estado de cosecha, para el panel global de HU-32. */
export interface EstadoCosechaGlobal {
  total: number;
  porEstado: Array<{
    estado: string;
    cuarteles: number;
    /** Redondeado a un decimal; suma 100 salvo por el redondeo. */
    porcentaje: number;
  }>;
}

/** Indicadores operativos, sin datos económicos. */
interface IndicadoresOperativos {
  fincasActivas: number;
  cuartelesActivos: number;
  alertasIotPendientes: number;
  remitosPendientesAprobacion: number;
  kgCosechadosCampaniaActual: number;
  /**
   * Campaña que acota `kgCosechadosCampaniaActual`, o `null` si la empresa no
   * tiene ninguna cargada. Va en el payload para que la pantalla pueda decir
   * *de qué período* está hablando en vez de dar por sentado el año calendario.
   */
  campaniaActual: {
    id: string;
    nombre: string;
    desde: string;
    hasta: string;
  } | null;
  estadoCosechaGlobal: EstadoCosechaGlobal;
}

/** Lo que ve el Capataz desde mobile (HU-32). */
interface IndicadoresCapataz {
  registrosPendientesSync: number;
  registrosConErrorSync: number;
  cuartelesEnCosecha: Array<{
    cuartelId: string;
    cuartelNombre: string;
    fincaNombre: string;
    kgCosechados: number;
  }>;
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
  | ({ rol: RolNombre.CAPATAZ } & IndicadoresOperativos & IndicadoresCapataz)
  | { rol: RolNombre.AUDITOR; eventosRecientes: LogAuditoria[] };

const ESTADO_COSECHA_VACIO: EstadoCosechaGlobal = { total: 0, porEstado: [] };

const OPERATIVOS_VACIOS: IndicadoresOperativos = {
  fincasActivas: 0,
  cuartelesActivos: 0,
  alertasIotPendientes: 0,
  remitosPendientesAprobacion: 0,
  kgCosechadosCampaniaActual: 0,
  campaniaActual: null,
  estadoCosechaGlobal: ESTADO_COSECHA_VACIO,
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
    @InjectRepository(PesajeVendimia)
    private readonly pesajeRepository: Repository<PesajeVendimia>,
    @InjectRepository(Remito)
    private readonly remitoRepository: Repository<Remito>,
    @InjectRepository(UsuarioFinca)
    private readonly usuarioFincaRepository: Repository<UsuarioFinca>,
    private readonly logAuditoriaService: LogAuditoriaService,
    private readonly campaniasService: CampaniasService,
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
    usuarioId: string,
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

    if (rol === RolNombre.CAPATAZ) {
      // El Capataz ve su propio tablero de campo: solo las fincas que tiene
      // asignadas. Es un **filtro de vista**, no un límite de permisos: el
      // alcance de datos sigue siendo por empresa (D-012). Sin asignaciones ve
      // todas las fincas, igual que con los avisos, para no dejarlo con un
      // tablero vacío mientras nadie configure nada.
      const fincaIds = await this.getFincaIdsDelCapataz(empresaId, usuarioId);
      const [operativos, propios] = await Promise.all([
        this.getOperativos(empresaId, fincaIds),
        this.getIndicadoresCapataz(usuarioId, fincaIds),
      ]);
      return { rol: RolNombre.CAPATAZ, ...operativos, ...propios };
    }

    // `@AnyRole()` ya le niega el dashboard al Administrador de plataforma
    // (D-025); esto mantiene el tipo de la respuesta honesto.
    if (rol !== RolNombre.PROPIETARIO && rol !== RolNombre.AGRONOMO) {
      throw new ForbiddenException('El dashboard es de los roles de empresa');
    }

    const operativos = await this.getOperativos(empresaId);

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

  /**
   * Fincas asignadas al Capataz, o todas las de la empresa si no tiene ninguna.
   * Se intersecta siempre contra las fincas activas de su empresa: una
   * asignación vieja a una finca de otro tenant no puede ampliar su vista.
   */
  private async getFincaIdsDelCapataz(
    empresaId: string,
    usuarioId: string,
  ): Promise<string[]> {
    const deLaEmpresa = await this.getFincaIds(empresaId);
    if (deLaEmpresa.length === 0) return [];

    const asignadas = await this.usuarioFincaRepository.find({
      where: { usuarioId },
      select: { fincaId: true },
    });
    if (asignadas.length === 0) return deLaEmpresa;

    const permitidas = new Set(deLaEmpresa);
    const filtradas = asignadas
      .map((a) => a.fincaId)
      .filter((id) => permitidas.has(id));
    return filtradas.length > 0 ? filtradas : deLaEmpresa;
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
    fincaIdsAcotados?: string[],
  ): Promise<IndicadoresOperativos> {
    const fincaIds = fincaIdsAcotados ?? (await this.getFincaIds(empresaId));
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

    // El corte lo da la campaña abierta (D-014). Antes era el año calendario
    // hardcodeado, que en Mendoza parte la vendimia al medio: la cosecha arranca
    // en febrero y el ciclo agrícola no coincide con el almanaque.
    const campania = await this.campaniasService.getActual(empresaId);

    const consultaKg = this.pesajeRepository
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.kg_totales), 0)', 'sum')
      .where('p.cuartel_id IN (:...cuartelIds)', { cuartelIds })
      .andWhere('p.estado_sync = :sync', { sync: EstadoSync.SINCRONIZADO });

    if (campania) {
      consultaKg.andWhere('p.fecha BETWEEN :desde AND :hasta', {
        desde: campania.fechaDesde,
        hasta: campania.fechaHasta,
      });
    } else {
      // Sin campaña cargada se cae al año calendario, que es el comportamiento
      // anterior. Es explícito para que la pantalla pueda avisar que el corte
      // no está definido, en vez de mostrar un número sin período.
      consultaKg.andWhere('EXTRACT(YEAR FROM p.fecha) = :anio', {
        anio: new Date().getFullYear(),
      });
    }

    const [kgCosechados, estadoCosechaGlobal] = await Promise.all([
      consultaKg.getRawOne<{ sum: string }>(),
      this.getEstadoCosechaGlobal(cuartelIds),
    ]);

    return {
      fincasActivas: fincaIds.length,
      cuartelesActivos,
      alertasIotPendientes,
      remitosPendientesAprobacion,
      kgCosechadosCampaniaActual: Number(kgCosechados?.sum ?? 0),
      campaniaActual: campania
        ? {
            id: campania.id,
            nombre: campania.nombre,
            desde: campania.fechaDesde,
            hasta: campania.fechaHasta,
          }
        : null,
      estadoCosechaGlobal,
    };
  }

  /**
   * Reparto de cuarteles activos por estado de cosecha (HU-32).
   *
   * Los estados sin ningún cuartel se devuelven igual, en 0: si el front solo
   * pintara lo que viene, una barra de progreso perdería la categoría vacía y
   * el reparto se leería distinto de un día para otro.
   */
  private async getEstadoCosechaGlobal(
    cuartelIds: string[],
  ): Promise<EstadoCosechaGlobal> {
    if (cuartelIds.length === 0) return ESTADO_COSECHA_VACIO;

    const filas = await this.cuartelRepository
      .createQueryBuilder('c')
      .select('c.estado', 'estado')
      .addSelect('COUNT(*)', 'total')
      .where('c.id IN (:...cuartelIds)', { cuartelIds })
      .andWhere('c.activo = true')
      .groupBy('c.estado')
      .getRawMany<{ estado: string | null; total: string }>();

    const conteo = new Map<string, number>();
    for (const fila of filas) {
      const estado = fila.estado ?? EstadoCuartel.PENDIENTE;
      conteo.set(estado, (conteo.get(estado) ?? 0) + Number(fila.total));
    }

    const total = [...conteo.values()].reduce((a, b) => a + b, 0);
    return {
      total,
      porEstado: Object.values(EstadoCuartel).map((estado) => {
        const cuarteles = conteo.get(estado) ?? 0;
        return {
          estado,
          cuarteles,
          porcentaje:
            total > 0 ? Math.round((cuarteles / total) * 1000) / 10 : 0,
        };
      }),
    };
  }

  /**
   * Tablero de campo del Capataz (HU-32): lo que le falta sincronizar y los
   * cuarteles que tiene en cosecha activa.
   *
   * Los pendientes son **suyos**: es el contador que le dice cuánto trabajo
   * quedó en el dispositivo, así que mezclar los de otros usuarios lo volvería
   * inútil como señal de "tengo que apretar Sincronizar".
   */
  private async getIndicadoresCapataz(
    usuarioId: string,
    fincaIds: string[],
  ): Promise<IndicadoresCapataz> {
    if (fincaIds.length === 0) {
      return {
        registrosPendientesSync: 0,
        registrosConErrorSync: 0,
        cuartelesEnCosecha: [],
      };
    }

    const [pendientes, conError, enCosecha] = await Promise.all([
      this.registroLaborRepository.count({
        where: { usuarioId, estadoSync: EstadoSync.PENDIENTE },
      }),
      this.registroLaborRepository.count({
        where: { usuarioId, estadoSync: EstadoSync.ERROR },
      }),
      this.registroLaborRepository.query<
        Array<{
          cuartelId: string;
          cuartelNombre: string;
          fincaNombre: string;
          kgCosechados: string;
        }>
      >(
        `SELECT c.id     AS "cuartelId",
                c.nombre AS "cuartelNombre",
                f.nombre AS "fincaNombre",
                COALESCE(SUM(p.kg_totales) FILTER (WHERE p.estado_sync = $2), 0)
                         AS "kgCosechados"
           FROM cuarteles c
           JOIN fincas f ON f.id = c.finca_id
           LEFT JOIN pesajes_vendimia p ON p.cuartel_id = c.id
          WHERE c.finca_id = ANY($1)
            AND c.activo = true
            AND c.estado = $3
          GROUP BY c.id, c.nombre, f.nombre
          ORDER BY f.nombre, c.nombre`,
        [fincaIds, EstadoSync.SINCRONIZADO, EstadoCuartel.EN_COSECHA],
      ),
    ]);

    return {
      registrosPendientesSync: pendientes,
      registrosConErrorSync: conError,
      cuartelesEnCosecha: enCosecha.map((c) => ({
        cuartelId: c.cuartelId,
        cuartelNombre: c.cuartelNombre,
        fincaNombre: c.fincaNombre,
        kgCosechados: Number(c.kgCosechados),
      })),
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
