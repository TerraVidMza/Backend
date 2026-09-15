import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  In,
  Repository,
} from 'typeorm';
import { RegistroLabor } from './entities/registro-labor.entity';
import { DetalleInsumoLabor } from './entities/detalle-insumo-labor.entity';
import { CreateRegistroLaborDto } from './dto/create-registro-labor.dto';
import { CosteoQueryDto } from './dto/costeo-query.dto';
import { ListarLaboresDto } from './dto/listar-labores.dto';
import { TipoLaborService } from '../tipo-labor/tipo-labor.service';
import { InsumosService } from '../insumos/insumos.service';
import { TipoLabor } from '../tipo-labor/entities/tipo-labor.entity';
import { Insumo } from '../insumos/entities/insumo.entity';
import { EstadoSync } from '../../common/enums/estado-sync.enum';
import {
  armarResultado,
  calcularPaginacion,
  ResultadoPaginado,
} from '../../common/dto/pagination-query.dto';
import { rangoDeFechasComoTexto } from '../../common/fechas/rango-fechas';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

export interface SyncResultItem {
  localUuid: string;
  estado: EstadoSync;
  registroId?: string;
  errorMessage?: string;
  /** true cuando el registro ya estaba sincronizado (reintento idempotente). */
  yaExistia?: boolean;
  /**
   * true cuando el registro usa un ítem de catálogo dado de baja (HU-14). Se
   * guardó igual, pero el cliente tiene que mostrarlo como advertencia.
   */
  inconsistenciaCatalogo?: boolean;
}

/**
 * Copia de la entidad con el costo unitario en `null`.
 *
 * Conserva el prototipo a propósito. class-transformer resuelve el `@Exclude()`
 * y el `@Expose()` de cada objeto por su constructor, así que un objeto
 * literal deja a la entidad sin metadatos de serialización. Hoy no cambia nada
 * —ni `RegistroLabor` ni `DetalleInsumoLabor` declaran ninguno, y el
 * `passwordHash` que viaja adentro lo saca el `Usuario` anidado, que conserva
 * su clase igual—, pero el día que se agregue un `@Exclude()` a estas dos
 * entidades no tendría efecto por este camino y nada fallaría a la vista.
 */
function copiaSinCosto<T extends { costoUnitarioAlSync: number | null }>(
  entidad: T,
): T {
  const copia = Object.assign(
    Object.create(Object.getPrototypeOf(entidad) as object) as T,
    entidad,
  );
  copia.costoUnitarioAlSync = null;
  return copia;
}

@Injectable()
export class RegistroLaborService {
  private readonly logger = new Logger(RegistroLaborService.name);

  constructor(
    @InjectRepository(RegistroLabor)
    private readonly registroLaborRepository: Repository<RegistroLabor>,
    @InjectRepository(DetalleInsumoLabor)
    private readonly detalleInsumoLaborRepository: Repository<DetalleInsumoLabor>,
    private readonly tipoLaborService: TipoLaborService,
    private readonly insumosService: InsumosService,
    private readonly notificacionesService: NotificacionesService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Historial de labores del cuartel, paginado y con filtros (HU-17).
   *
   * Solo registros sincronizados: los que quedaron en error no son trabajo
   * confirmado y no deben sumar al historial ni al costeo.
   *
   * `restringirA` acota el resultado a un usuario y una fecha. Se usa para el
   * Capataz, que según HU-17 solo ve **sus** registros **del día**: el resto
   * del historial del cuartel incluye costos y trabajo de terceros.
   *
   * `ocultarCostos` saca el costo unitario de la labor y de cada insumo. Es
   * para el Auditor: HU-17 le da la trazabilidad del cuartel —qué se hizo,
   * cuándo y quién— pero no el alcance económico, que `costeo` y
   * `margen-bruto` ya le niegan. Sin esto, el dato que esos dos endpoints le
   * cierran salía igual por el historial, insumo por insumo.
   */
  async findByCuartel(
    cuartelId: string,
    query: ListarLaboresDto = {},
    restringirA?: { usuarioId: string; fecha: string },
    ocultarCostos = false,
  ): Promise<ResultadoPaginado<RegistroLabor>> {
    const { page, pageSize, skip, take } = calcularPaginacion(query);

    const where: FindOptionsWhere<RegistroLabor> = {
      cuartelId,
      estadoSync: EstadoSync.SINCRONIZADO,
    };

    if (query.tipoLaborId) where.tipoLaborId = query.tipoLaborId;
    if (query.usuarioId) where.usuarioId = query.usuarioId;

    const rango = rangoDeFechasComoTexto(query.desde, query.hasta);
    if (rango) where.fecha = rango;

    // La restricción por rol se aplica al final para que no pueda ser relajada
    // por un filtro del query string.
    if (restringirA) {
      where.usuarioId = restringirA.usuarioId;
      where.fecha = restringirA.fecha;
    }

    const [registros, total] = await this.registroLaborRepository.findAndCount({
      where,
      // `detalles` viene incluido: sin los insumos, la fila del historial no
      // puede mostrar el costo real de la labor (criterio de HU-17).
      relations: {
        tipoLabor: true,
        usuario: true,
        detalles: { insumo: true },
      },
      order: { fecha: 'DESC', createdAt: 'DESC' },
      skip,
      take,
    });

    return armarResultado(
      [
        ocultarCostos ? registros.map((r) => this.sinCostos(r)) : registros,
        total,
      ],
      page,
      pageSize,
    );
  }

  /** El registro y sus detalles, con los costos en `null`. */
  private sinCostos(registro: RegistroLabor): RegistroLabor {
    const copia = copiaSinCosto(registro);
    if (registro.detalles) {
      copia.detalles = registro.detalles.map((d) => copiaSinCosto(d));
    }
    return copia;
  }

  /**
   * `empresaId` acota al tenant siguiendo la cadena cuartel → finca → empresa.
   *
   * `ocultarCostos` sigue el mismo criterio que `findByCuartel`: el Auditor
   * llega a este endpoint y no debe ver el costo unitario.
   */
  async findById(
    id: string,
    empresaId: string,
    ocultarCostos = false,
  ): Promise<RegistroLabor> {
    const registro = await this.registroLaborRepository.findOne({
      where: { id, cuartel: { finca: { empresaId } } },
      relations: { tipoLabor: true, cuartel: { finca: true }, usuario: true },
    });
    if (!registro) {
      throw new NotFoundException('Registro de labor no encontrado');
    }
    return ocultarCostos ? this.sinCostos(registro) : registro;
  }

  /**
   * Sincroniza un registro creado offline.
   *
   * Idempotente por `local_uuid`: reenviar un registro ya sincronizado devuelve
   * el existente sin duplicar. Un registro que quedó en ERROR **sí** se
   * reprocesa, para que el Capataz pueda corregir el dato y reintentar con el
   * mismo uuid (antes se le devolvía el error viejo para siempre).
   */
  async registrarUno(
    dto: CreateRegistroLaborDto,
    usuarioId: string,
  ): Promise<SyncResultItem> {
    const existente = await this.registroLaborRepository.findOne({
      where: { localUuid: dto.localUuid },
    });

    if (existente && existente.estadoSync !== EstadoSync.ERROR) {
      return {
        localUuid: dto.localUuid,
        estado: existente.estadoSync,
        registroId: existente.id,
        yaExistia: true,
      };
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        // Reemplaza el intento fallido anterior, si lo hubo.
        if (existente) {
          await manager.delete(DetalleInsumoLabor, {
            registroLaborId: existente.id,
          });
          await manager.delete(RegistroLabor, { id: existente.id });
        }

        this.validarInsumosNoDuplicados(dto);

        const costoLabor = await this.tipoLaborService.getCostoVigente(
          dto.tipoLaborId,
          dto.fecha,
        );
        // Sin costo vigente el registro valdría $0 y quedaría marcado como
        // sincronizado, falseando el costeo en silencio. Se rechaza.
        if (!costoLabor) {
          throw new Error(
            `No hay costo vigente para el tipo de labor a la fecha ${dto.fecha}. Cargá el costo antes de sincronizar.`,
          );
        }

        // El trabajo físico ya ocurrió en la finca: si el catálogo cambió
        // después de la última descarga del dispositivo, el registro se acepta
        // igual y se marca para que el Propietario lo revise (HU-14). Rechazarlo
        // perdería el dato del trabajo realizado.
        const inconsistenciaCatalogo = await this.detectarInconsistencia(
          manager,
          dto,
        );

        const registro = manager.create(RegistroLabor, {
          localUuid: dto.localUuid,
          cuartelId: dto.cuartelId,
          tipoLaborId: dto.tipoLaborId,
          usuarioId,
          fecha: dto.fecha,
          cantidad: dto.cantidad,
          costoUnitarioAlSync: costoLabor.costoUnitario,
          estadoSync: EstadoSync.SINCRONIZADO,
          errorMessage: null,
          createdAtLocal: dto.createdAtLocal
            ? new Date(dto.createdAtLocal)
            : new Date(),
          inconsistenciaCatalogo,
          syncedAt: new Date(),
        });
        const registroGuardado = await manager.save(registro);

        for (const item of dto.insumos) {
          const costoInsumo = await this.insumosService.getCostoVigente(
            item.insumoId,
            dto.fecha,
          );
          if (!costoInsumo) {
            throw new Error(
              `No hay costo vigente para el insumo ${item.insumoId} a la fecha ${dto.fecha}. Cargá el costo antes de sincronizar.`,
            );
          }
          const detalle = manager.create(DetalleInsumoLabor, {
            registroLaborId: registroGuardado.id,
            insumoId: item.insumoId,
            cantidadUsada: item.cantidadUsada,
            costoUnitarioAlSync: costoInsumo.costoUnitario,
          });
          await manager.save(detalle);
        }

        return {
          localUuid: dto.localUuid,
          estado: EstadoSync.SINCRONIZADO,
          registroId: registroGuardado.id,
          inconsistenciaCatalogo,
        };
      });
    } catch (error) {
      const mensaje = (error as Error).message;
      this.logger.error(
        `Error al sincronizar registro ${dto.localUuid}: ${mensaje}`,
      );
      // Fuera del `transaction` de arriba a propósito: esa transacción quedó
      // abortada y en Postgres cualquier escritura posterior dentro de ella
      // falla con "current transaction is aborted".
      await this.persistirRegistroConError(dto, usuarioId, mensaje);
      return {
        localUuid: dto.localUuid,
        estado: EstadoSync.ERROR,
        errorMessage: mensaje,
      };
    }
  }

  async sincronizarLote(
    registros: CreateRegistroLaborDto[],
    usuarioId: string,
  ): Promise<SyncResultItem[]> {
    const resultados: SyncResultItem[] = [];
    // Más antiguos primero (HU-14): si dos registros del mismo cuartel entran
    // en el mismo lote, el orden de proceso tiene que respetar el orden en que
    // ocurrieron en la finca, no el orden en que el cliente los serializó.
    const enOrden = [...registros].sort((a, b) =>
      (a.createdAtLocal ?? '').localeCompare(b.createdAtLocal ?? ''),
    );
    for (const registro of enOrden) {
      // Cada ítem se resuelve por separado: un registro inválido no puede
      // tumbar el lote entero.
      try {
        resultados.push(await this.registrarUno(registro, usuarioId));
      } catch (error) {
        const mensaje = (error as Error).message;
        this.logger.error(
          `Fallo inesperado sincronizando ${registro.localUuid}: ${mensaje}`,
        );
        resultados.push({
          localUuid: registro.localUuid,
          estado: EstadoSync.ERROR,
          errorMessage: mensaje,
        });
      }
    }

    await this.notificarErroresDeSync(resultados, usuarioId);
    return resultados;
  }

  /**
   * Avisa al Capataz que parte de su lote quedó en error (HU-35).
   *
   * Es el tercer productor de eventos que pide la HU, junto con las alertas IoT
   * y los remitos. Sin él, el trabajo que no entró solo se veía como un número
   * en el dashboard del Propietario: **quien puede corregirlo no se enteraba**.
   *
   * Una sola notificación por lote y no una por registro: un lote de diez
   * registros con un catálogo desactualizado falla entero, y diez avisos
   * idénticos son ruido que se descarta sin leer.
   */
  private async notificarErroresDeSync(
    resultados: SyncResultItem[],
    usuarioId: string,
  ): Promise<void> {
    const fallidos = resultados.filter((r) => r.estado === EstadoSync.ERROR);
    if (fallidos.length === 0) return;

    try {
      await this.notificacionesService.crear({
        usuarioId,
        tipo: 'error_sincronizacion',
        titulo: `${fallidos.length} registro(s) no se sincronizaron`,
        descripcion:
          fallidos.length === 1
            ? `El registro quedó en error: ${fallidos[0].errorMessage ?? 'motivo no informado'}`
            : `${fallidos.length} registros de labor quedaron en error de sincronización. Revisalos y volvé a enviarlos.`,
        urlAccion: '/labores?estadoSync=error',
      });
    } catch (error) {
      // Que falle el aviso no puede cambiar el resultado de la sincronización,
      // que ya está persistido y es lo que el dispositivo necesita saber.
      this.logger.error(
        `No se pudo notificar el error de sincronización: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Tabla de costeo de todos los cuarteles de la empresa (HU-15).
   *
   * Se agrega en SQL, no en JS: la versión anterior traía a memoria todos los
   * `RegistroLabor` y `DetalleInsumoLabor` históricos para reducirlos con
   * `Array.reduce`, y eso crece con el histórico completo de la empresa contra
   * un objetivo de P95 < 3 s.
   *
   * Los insumos van en una subconsulta aparte y no en un JOIN directo: unir
   * labores y detalles en la misma agregación multiplica cada labor por su
   * cantidad de insumos e **infla el costo de mano de obra**.
   */
  async getCosteoPorCuartel(
    empresaId: string,
    query: CosteoQueryDto = {},
  ): Promise<{
    cuarteles: Array<{
      cuartelId: string;
      cuartelNombre: string;
      fincaId: string;
      fincaNombre: string;
      hectareas: number | null;
      costoLabores: number;
      costoInsumos: number;
      costoTotal: number;
      costoPorHa: number | null;
      ingresos: number;
      /** Cantidad de liquidaciones cargadas; 0 significa margen desconocido. */
      liquidaciones: number;
      margenBruto: number | null;
      margenBrutoDisponible: boolean;
      margenBrutoPorHa: number | null;
    }>;
    totales: {
      costoLabores: number;
      costoInsumos: number;
      costoTotal: number;
      hectareas: number;
      costoPorHa: number | null;
      ingresos: number;
      margenBruto: number | null;
      margenBrutoDisponible: boolean;
    };
  }> {
    const filas = await this.registroLaborRepository.query<
      Array<{
        cuartelId: string;
        cuartelNombre: string;
        fincaId: string;
        fincaNombre: string;
        hectareas: string | null;
        costoLabores: string;
        costoInsumos: string;
        ingresos: string;
        liquidaciones: string;
      }>
    >(
      `
      SELECT c.id                      AS "cuartelId",
             c.nombre                  AS "cuartelNombre",
             f.id                      AS "fincaId",
             f.nombre                  AS "fincaNombre",
             c.hectareas               AS "hectareas",
             COALESCE(l.costo, 0)      AS "costoLabores",
             COALESCE(i.costo, 0)      AS "costoInsumos",
             COALESCE(v.ingreso, 0)    AS "ingresos",
             COALESCE(v.liquidaciones, 0) AS "liquidaciones"
        FROM cuarteles c
        JOIN fincas f ON f.id = c.finca_id
        LEFT JOIN (
              SELECT rl.cuartel_id,
                     SUM(rl.cantidad * COALESCE(rl.costo_unitario_al_sync, 0)) AS costo
                FROM registro_labor rl
               WHERE rl.estado_sync = $2
                 AND ($3::date IS NULL OR rl.fecha >= $3::date)
                 AND ($4::date IS NULL OR rl.fecha <= $4::date)
               GROUP BY rl.cuartel_id
             ) l ON l.cuartel_id = c.id
        LEFT JOIN (
              SELECT rl.cuartel_id,
                     SUM(d.cantidad_usada * COALESCE(d.costo_unitario_al_sync, 0)) AS costo
                FROM detalle_insumo_labor d
                JOIN registro_labor rl ON rl.id = d.registro_labor_id
               WHERE rl.estado_sync = $2
                 AND ($3::date IS NULL OR rl.fecha >= $3::date)
                 AND ($4::date IS NULL OR rl.fecha <= $4::date)
               GROUP BY rl.cuartel_id
             ) i ON i.cuartel_id = c.id
        LEFT JOIN (
              -- Ingreso real: lo que la bodega pagó por los remitos del cuartel
              -- (D-005). Se filtra por la fecha del remito, que es la jornada
              -- cosechada, no por la fecha en que la bodega liquidó —que suele
              -- ser semanas posterior y caería en otro período.
              SELECT r.cuartel_id,
                     SUM(lb.monto_neto) AS ingreso,
                     COUNT(*)           AS liquidaciones
                FROM liquidaciones_bodega lb
                JOIN remitos r ON r.id = lb.remito_id
               WHERE ($3::date IS NULL OR r.fecha >= $3::date)
                 AND ($4::date IS NULL OR r.fecha <= $4::date)
               GROUP BY r.cuartel_id
             ) v ON v.cuartel_id = c.id
       WHERE f.empresa_id = $1
         AND c.activo = true
         AND ($5::uuid IS NULL OR f.id = $5::uuid)
       ORDER BY f.nombre, c.nombre
      `,
      [
        empresaId,
        EstadoSync.SINCRONIZADO,
        query.desde ?? null,
        query.hasta ?? null,
        query.fincaId ?? null,
      ],
    );

    const cuarteles = filas.map((fila) => {
      const costoLabores = Number(fila.costoLabores);
      const costoInsumos = Number(fila.costoInsumos);
      const costoTotal = costoLabores + costoInsumos;
      const hectareas = fila.hectareas === null ? null : Number(fila.hectareas);
      const liquidaciones = Number(fila.liquidaciones);
      const ingresos = Number(fila.ingresos);

      // Sin ninguna liquidación cargada el margen es desconocido, no cero: un 0
      // se leería como "no ganó nada", que es una afirmación distinta.
      const margenBrutoDisponible = liquidaciones > 0;
      const margenBruto = margenBrutoDisponible
        ? Math.round((ingresos - costoTotal) * 100) / 100
        : null;

      return {
        cuartelId: fila.cuartelId,
        cuartelNombre: fila.cuartelNombre,
        fincaId: fila.fincaId,
        fincaNombre: fila.fincaNombre,
        hectareas,
        costoLabores,
        costoInsumos,
        costoTotal,
        // `null` y no 0 cuando falta la superficie: un 0 acá se leería como
        // "no cuesta nada por hectárea", que es lo contrario del dato faltante.
        costoPorHa:
          hectareas && hectareas > 0
            ? Math.round((costoTotal / hectareas) * 100) / 100
            : null,
        ingresos,
        liquidaciones,
        margenBruto,
        margenBrutoDisponible,
        margenBrutoPorHa:
          margenBruto !== null && hectareas && hectareas > 0
            ? Math.round((margenBruto / hectareas) * 100) / 100
            : null,
      };
    });

    const totalLabores = cuarteles.reduce((a, c) => a + c.costoLabores, 0);
    const totalInsumos = cuarteles.reduce((a, c) => a + c.costoInsumos, 0);
    const totalHectareas = cuarteles.reduce(
      (a, c) => a + (c.hectareas ?? 0),
      0,
    );
    const totalIngresos = cuarteles.reduce((a, c) => a + c.ingresos, 0);
    const totalLiquidaciones = cuarteles.reduce(
      (a, c) => a + c.liquidaciones,
      0,
    );
    const costoTotal = totalLabores + totalInsumos;
    const hayIngresos = totalLiquidaciones > 0;

    return {
      cuarteles,
      totales: {
        costoLabores: totalLabores,
        costoInsumos: totalInsumos,
        costoTotal,
        hectareas: totalHectareas,
        costoPorHa:
          totalHectareas > 0
            ? Math.round((costoTotal / totalHectareas) * 100) / 100
            : null,
        ingresos: totalIngresos,
        margenBruto: hayIngresos
          ? Math.round((totalIngresos - costoTotal) * 100) / 100
          : null,
        margenBrutoDisponible: hayIngresos,
      },
    };
  }

  /**
   * Costeo y margen de un solo cuartel (HU-15).
   *
   * Con la liquidación de bodega en el modelo (D-005) el margen ya es real:
   * `ingresos − costoTotal`. Sigue devolviéndose `null` —y no 0— cuando no hay
   * ninguna liquidación cargada, porque "todavía no se sabe" y "no ganó nada"
   * son afirmaciones distintas.
   */
  async getMargenBrutoPorCuartel(cuartelId: string): Promise<{
    costoLabores: number;
    costoInsumos: number;
    costoTotal: number;
    ingresos: number;
    liquidaciones: number;
    margenBruto: number | null;
    margenBrutoDisponible: boolean;
    motivo?: string;
  }> {
    const registros = await this.registroLaborRepository.find({
      where: { cuartelId, estadoSync: EstadoSync.SINCRONIZADO },
    });
    const costoLabores = registros.reduce(
      (acc, r) => acc + Number(r.cantidad) * Number(r.costoUnitarioAlSync ?? 0),
      0,
    );

    const registroIds = registros.map((r) => r.id);
    let costoInsumos = 0;
    if (registroIds.length > 0) {
      const detalles = await this.detalleInsumoLaborRepository.find({
        where: { registroLaborId: In(registroIds) },
      });
      costoInsumos = detalles.reduce(
        (acc, d) =>
          acc + Number(d.cantidadUsada) * Number(d.costoUnitarioAlSync ?? 0),
        0,
      );
    }

    const [ingreso] = await this.registroLaborRepository.query<
      Array<{ ingresos: string; liquidaciones: string }>
    >(
      `SELECT COALESCE(SUM(lb.monto_neto), 0) AS "ingresos",
              COUNT(*)                        AS "liquidaciones"
         FROM liquidaciones_bodega lb
         JOIN remitos r ON r.id = lb.remito_id
        WHERE r.cuartel_id = $1`,
      [cuartelId],
    );

    const ingresos = Number(ingreso?.ingresos ?? 0);
    const liquidaciones = Number(ingreso?.liquidaciones ?? 0);
    const costoTotal = costoLabores + costoInsumos;
    const margenBrutoDisponible = liquidaciones > 0;

    return {
      costoLabores,
      costoInsumos,
      costoTotal,
      ingresos,
      liquidaciones,
      margenBruto: margenBrutoDisponible
        ? Math.round((ingresos - costoTotal) * 100) / 100
        : null,
      margenBrutoDisponible,
      ...(margenBrutoDisponible
        ? {}
        : {
            motivo:
              'Todavía no hay liquidaciones de bodega cargadas para los remitos de este cuartel.',
          }),
    };
  }
  /**
   * ¿Alguno de los ítems de catálogo que usa el registro está dado de baja?
   *
   * Se consulta con el `manager` de la transacción en curso para leer el mismo
   * estado que ve el resto de la operación.
   */
  private async detectarInconsistencia(
    manager: EntityManager,
    dto: CreateRegistroLaborDto,
  ): Promise<boolean> {
    const tipoLaborDeBaja = await manager.exists(TipoLabor, {
      where: { id: dto.tipoLaborId, activo: false },
    });
    if (tipoLaborDeBaja) return true;

    if (dto.insumos.length === 0) return false;

    return manager.exists(Insumo, {
      where: { id: In(dto.insumos.map((i) => i.insumoId)), activo: false },
    });
  }

  /**
   * Un mismo insumo dos veces en la misma labor duplicaba su costo sin aviso.
   */
  private validarInsumosNoDuplicados(dto: CreateRegistroLaborDto): void {
    const ids = dto.insumos.map((i) => i.insumoId);
    const duplicado = ids.find((id, i) => ids.indexOf(id) !== i);
    if (duplicado) {
      throw new Error(
        `El insumo ${duplicado} está repetido en la misma labor. Sumá las cantidades en una sola línea.`,
      );
    }
  }

  private async persistirRegistroConError(
    dto: CreateRegistroLaborDto,
    usuarioId: string,
    mensaje: string,
  ): Promise<void> {
    try {
      const previo = await this.registroLaborRepository.findOne({
        where: { localUuid: dto.localUuid },
      });
      if (previo) {
        await this.registroLaborRepository.update(previo.id, {
          estadoSync: EstadoSync.ERROR,
          errorMessage: mensaje,
        });
        return;
      }
      await this.registroLaborRepository.save(
        this.registroLaborRepository.create({
          localUuid: dto.localUuid,
          cuartelId: dto.cuartelId,
          tipoLaborId: dto.tipoLaborId,
          usuarioId,
          fecha: dto.fecha,
          cantidad: dto.cantidad,
          estadoSync: EstadoSync.ERROR,
          errorMessage: mensaje,
        }),
      );
    } catch (error) {
      this.logger.error(
        `No se pudo persistir el estado de error de ${dto.localUuid}: ${(error as Error).message}`,
      );
    }
  }
}
