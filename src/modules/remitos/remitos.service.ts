import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { ListarRemitosDto } from './dto/listar-remitos.dto';
import { RegistrarLiquidacionDto } from './dto/registrar-liquidacion.dto';
import { LiquidacionBodega } from './entities/liquidacion-bodega.entity';
import {
  armarResultado,
  calcularPaginacion,
  ResultadoPaginado,
} from '../../common/dto/pagination-query.dto';
import { EstadoRemito, Remito } from './entities/remito.entity';
import { PesajeVendimia } from '../pesaje-vendimia/entities/pesaje-vendimia.entity';
import { EstadoPesaje } from '../pesaje-vendimia/entities/estado-pesaje.enum';
import { Cuartel } from '../cuarteles/entities/cuartel.entity';
import { EstadoCuartel } from '../cuarteles/entities/estado-cuartel.enum';
import { EstadoSync } from '../../common/enums/estado-sync.enum';
import { RolNombre } from '../../common/enums/rol.enum';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { hoyLocal } from '../../common/fechas/rango-fechas';

@Injectable()
export class RemitosService {
  private readonly logger = new Logger(RemitosService.name);

  constructor(
    @InjectRepository(Remito)
    private readonly remitoRepository: Repository<Remito>,
    @InjectRepository(PesajeVendimia)
    private readonly pesajeRepository: Repository<PesajeVendimia>,
    @InjectRepository(Cuartel)
    private readonly cuartelRepository: Repository<Cuartel>,
    @InjectRepository(LiquidacionBodega)
    private readonly liquidacionRepository: Repository<LiquidacionBodega>,
    private readonly notificacionesService: NotificacionesService,
    private readonly usuariosService: UsuariosService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Listado de remitos de la empresa, con filtros opcionales y paginación.
   *
   * El alcance sale siempre de `empresaId` siguiendo cuartel → finca → empresa,
   * así que un `cuartelId` de otra empresa no devuelve nada en vez de filtrar.
   */
  async findAll(
    empresaId: string,
    query: ListarRemitosDto = {},
  ): Promise<ResultadoPaginado<Remito>> {
    const { page, pageSize, skip, take } = calcularPaginacion(query);

    const where: FindOptionsWhere<Remito> = {
      cuartel: { finca: { empresaId } },
    };
    if (query.cuartelId) {
      where.cuartelId = query.cuartelId;
    }
    if (query.estado) {
      where.estado = query.estado;
    }
    if (query.fincaId) {
      where.cuartel = { finca: { empresaId, id: query.fincaId } };
    }

    const resultado = await this.remitoRepository.findAndCount({
      where,
      relations: { cuartel: { finca: true } },
      order: { fechaGeneracion: 'DESC' },
      skip,
      take,
    });

    return armarResultado(resultado, page, pageSize);
  }

  /**
   * Remito con todo lo que necesita la vista imprimible de HU-27: el cuartel,
   * la finca y el detalle de pesajes que lo componen. Sin los pesajes, la
   * pantalla de aprobación no tenía datos que mostrar más que los totales.
   */
  async findByIdConDetalle(
    id: string,
    empresaId: string,
  ): Promise<Remito & { pesajes: PesajeVendimia[] }> {
    const remito = await this.remitoRepository.findOne({
      where: { id, cuartel: { finca: { empresaId } } },
      relations: { cuartel: { finca: true, variedad: true } },
    });
    if (!remito) {
      throw new NotFoundException('Remito no encontrado');
    }

    const pesajes = await this.pesajeRepository.find({
      where: { remitoId: id },
      relations: { cuadrilla: true },
      order: { fecha: 'ASC' },
    });

    return Object.assign(remito, { pesajes });
  }

  /**
   * `empresaId` acota al tenant siguiendo cuartel → finca → empresa. Es
   * especialmente importante acá: `aprobar` y `rechazar` resuelven el remito
   * por este método, y sin el filtro un Propietario podía aprobar el despacho
   * de otra empresa conociendo el UUID.
   */
  async findById(id: string, empresaId: string): Promise<Remito> {
    const remito = await this.remitoRepository.findOne({
      where: { id, cuartel: { finca: { empresaId } } },
      relations: { cuartel: { finca: true } },
    });
    if (!remito) {
      throw new NotFoundException('Remito no encontrado');
    }
    return remito;
  }

  /**
   * Registra la liquidación que la bodega pagó por un remito (D-005).
   *
   * Solo sobre remitos **aprobados**: un borrador todavía puede rechazarse, y
   * un remito rechazado nunca llegó a la bodega. Es idempotente por remito
   * —el UNIQUE lo garantiza—: volver a llamar actualiza la liquidación
   * existente, que es lo que hace falta cuando la bodega emite una corrección.
   */
  async registrarLiquidacion(
    remitoId: string,
    dto: RegistrarLiquidacionDto,
    registradoPorId: string,
    empresaId: string,
  ): Promise<LiquidacionBodega> {
    const remito = await this.findById(remitoId, empresaId);

    if (remito.estado !== EstadoRemito.APROBADO) {
      throw new BadRequestException(
        'Solo se puede liquidar un remito aprobado: es el único que llegó a la bodega.',
      );
    }

    // Redondeo explícito: la columna es `decimal(_, 2)` y dejar que la base
    // trunque un float de JS produce diferencias de centavos.
    const bruto = Number(dto.kgAceptados) * Number(dto.precioPorKg);
    const descuentos = Number(dto.descuentos ?? 0);
    const montoNeto = Math.round((bruto - descuentos) * 100) / 100;

    if (montoNeto < 0) {
      throw new BadRequestException(
        'Los descuentos no pueden superar el importe bruto de la liquidación.',
      );
    }

    const existente = await this.liquidacionRepository.findOne({
      where: { remitoId },
    });

    return this.liquidacionRepository.save(
      this.liquidacionRepository.create({
        ...(existente ? { id: existente.id } : {}),
        remitoId,
        bodega: dto.bodega,
        kgAceptados: dto.kgAceptados,
        precioPorKg: dto.precioPorKg,
        descuentos,
        montoNeto,
        fecha: dto.fecha.slice(0, 10),
        numeroComprobante: dto.numeroComprobante ?? null,
        registradoPorId,
      }),
    );
  }

  /** Liquidación de un remito, o `null` si la bodega todavía no liquidó. */
  async getLiquidacion(
    remitoId: string,
    empresaId: string,
  ): Promise<LiquidacionBodega | null> {
    await this.findById(remitoId, empresaId);
    return this.liquidacionRepository.findOne({ where: { remitoId } });
  }

  async generarBorrador(
    cuartelId: string,
    generadoPorId: string,
    fecha?: string,
  ): Promise<Remito> {
    return this.dataSource
      .transaction(async (manager) => {
        // Serializa por cuartel: sin este lock, dos Capataces concurrentes leen
        // el mismo set de pesajes y crean dos remitos, y el primero queda con
        // totales de pesajes que ya no le pertenecen.
        await manager.query(
          'SELECT id FROM cuarteles WHERE id = $1 FOR UPDATE',
          [cuartelId],
        );

        const borradorExistente = await manager.findOne(Remito, {
          where: { cuartelId, estado: EstadoRemito.BORRADOR },
        });
        if (borradorExistente) {
          throw new ConflictException(
            'Este cuartel ya se encuentra en proceso de liquidación o pendiente de aprobación por otro usuario',
          );
        }

        const pesajesPendientes = await manager.find(PesajeVendimia, {
          where: {
            cuartelId,
            estado: EstadoPesaje.PENDIENTE_REMITO,
            // Solo cosecha confirmada: un pesaje en error suma kilos pero no
            // tiene liquidación, y dejaría un remito con kg que nadie paga.
            estadoSync: EstadoSync.SINCRONIZADO,
            // Acotado a la jornada cuando se indica (HU-26).
            ...(fecha ? { fecha: fecha.slice(0, 10) } : {}),
          },
        });

        if (pesajesPendientes.length === 0) {
          throw new BadRequestException(
            fecha
              ? `No hay pesajes sincronizados pendientes de remito para este cuartel el ${fecha.slice(0, 10)}.`
              : 'No hay pesajes sincronizados pendientes de remito para este cuartel. Verificá que los registros estén sincronizados.',
          );
        }

        const totalKg = pesajesPendientes.reduce(
          (acc, p) => acc + Number(p.kgTotales),
          0,
        );
        const totalLiquidacion = pesajesPendientes.reduce(
          (acc, p) => acc + Number(p.montoLiquidacion ?? 0),
          0,
        );

        const numeroRemito = await this.generarNumeroRemito(manager);

        const remito = manager.create(Remito, {
          numeroRemito,
          cuartelId,
          generadoPorId,
          estado: EstadoRemito.BORRADOR,
          totalKg,
          totalLiquidacion: Math.round(totalLiquidacion * 100) / 100,
          // La fecha del remito es la de la jornada liquidada, no la de hoy.
          fecha: fecha?.slice(0, 10) ?? hoyLocal(),
        });
        const remitoGuardado = await manager.save(remito);

        const ids = pesajesPendientes.map((p) => p.id);
        await manager.update(PesajeVendimia, ids, {
          remitoId: remitoGuardado.id,
          estado: EstadoPesaje.EN_REMITO,
        });

        // Fuera de la transacción no se puede: si el remito hace rollback, la
        // notificación quedaría avisando de algo que no existe. Se emite después
        // de confirmar, en el `then` del método.
        return remitoGuardado;
      })
      .then(async (remito) => {
        await this.notificarBorradorGenerado(remito, generadoPorId);
        return remito;
      });
  }

  /**
   * Avisa a quienes pueden aprobar que hay un remito esperando (HU-26).
   *
   * Nunca propaga: el remito ya está guardado y un fallo de notificación no
   * puede convertirse en un error para quien lo generó.
   */
  private async notificarBorradorGenerado(
    remito: Remito,
    generadoPorId: string,
  ): Promise<void> {
    try {
      const cuartel = await this.cuartelRepository.findOne({
        where: { id: remito.cuartelId },
        relations: { finca: true },
      });
      if (!cuartel) return;

      const aprobadores = await this.usuariosService.findByRolesInEmpresa(
        cuartel.finca.empresaId,
        [RolNombre.PROPIETARIO, RolNombre.AGRONOMO],
      );

      for (const aprobador of aprobadores) {
        // Quien lo generó no necesita que le avisen de su propia acción.
        if (aprobador.id === generadoPorId) continue;
        await this.notificacionesService.crear({
          usuarioId: aprobador.id,
          tipo: 'remito_pendiente',
          titulo: `Remito ${remito.numeroRemito} pendiente de aprobación`,
          descripcion: `El cuartel ${cuartel.nombre} generó un remito por ${remito.totalKg} kg. Requiere tu aprobación.`,
          urlAccion: `/remitos/${remito.id}`,
        });
      }
    } catch (error) {
      this.logger.error(
        `No se pudo notificar el remito ${remito.numeroRemito}: ${(error as Error).message}`,
      );
    }
  }

  /** Avisa al Capataz que generó el remito cómo se resolvió (HU-27). */
  private async notificarResolucion(
    remito: Remito,
    aprobado: boolean,
    motivo?: string,
  ): Promise<void> {
    try {
      await this.notificacionesService.crear({
        usuarioId: remito.generadoPorId,
        tipo: aprobado ? 'remito_aprobado' : 'remito_rechazado',
        titulo: `Remito ${remito.numeroRemito} ${aprobado ? 'aprobado' : 'rechazado'}`,
        descripcion: aprobado
          ? `El remito por ${remito.totalKg} kg fue aprobado y la liquidación quedó confirmada.`
          : `El remito fue rechazado. Motivo: ${motivo ?? 'sin especificar'}. Los pesajes quedaron en revisión.`,
        urlAccion: `/remitos/${remito.id}`,
      });
    } catch (error) {
      this.logger.error(
        `No se pudo notificar la resolución del remito ${remito.numeroRemito}: ${(error as Error).message}`,
      );
    }
  }

  async aprobar(
    id: string,
    aprobadoPorId: string,
    empresaId: string,
  ): Promise<Remito> {
    return this.dataSource
      .transaction(async (manager) => {
        const remito = await manager.findOne(Remito, {
          where: { id, cuartel: { finca: { empresaId } } },
          relations: { cuartel: { finca: true } },
        });
        if (!remito) {
          throw new NotFoundException('Remito no encontrado');
        }
        if (remito.estado !== EstadoRemito.BORRADOR) {
          throw new BadRequestException(
            'Solo se pueden aprobar remitos en estado borrador',
          );
        }

        remito.estado = EstadoRemito.APROBADO;
        remito.aprobadoPorId = aprobadoPorId;
        remito.fechaAprobacion = new Date();
        const guardado = await manager.save(remito);

        await manager.update(
          PesajeVendimia,
          { remitoId: id },
          { estado: EstadoPesaje.LIQUIDADO },
        );

        // El remito aprobado cierra la cosecha del cuartel (HU-28).
        await manager.update(Cuartel, remito.cuartelId, {
          estado: EstadoCuartel.COSECHADO,
        });

        return guardado;
      })
      .then(async (remito) => {
        await this.notificarResolucion(remito, true);
        return remito;
      });
  }

  async rechazar(
    id: string,
    rechazadoPorId: string,
    motivoRechazo: string,
    empresaId: string,
  ): Promise<Remito> {
    return this.dataSource
      .transaction(async (manager) => {
        const remito = await manager.findOne(Remito, {
          where: { id, cuartel: { finca: { empresaId } } },
          relations: { cuartel: { finca: true } },
        });
        if (!remito) {
          throw new NotFoundException('Remito no encontrado');
        }
        if (remito.estado !== EstadoRemito.BORRADOR) {
          throw new BadRequestException(
            'Solo se pueden rechazar remitos en estado borrador',
          );
        }

        remito.estado = EstadoRemito.RECHAZADO;
        remito.rechazadoPorId = rechazadoPorId;
        remito.motivoRechazo = motivoRechazo;
        remito.fechaRechazo = new Date();
        const guardado = await manager.save(remito);

        // Pasan a `observado`, no a `pendiente_remito`: deben revisarse antes de
        // volver al circuito. Se conserva `remitoId` para no perder la
        // trazabilidad al remito que los rechazó.
        await manager.update(
          PesajeVendimia,
          { remitoId: id },
          { estado: EstadoPesaje.OBSERVADO },
        );

        // El cuartel vuelve a estar en cosecha: el Capataz puede corregir los
        // pesajes observados y generar un remito nuevo (HU-27).
        await manager.update(Cuartel, remito.cuartelId, {
          estado: EstadoCuartel.EN_COSECHA,
        });

        return guardado;
      })
      .then(async (remito) => {
        await this.notificarResolucion(remito, false, motivoRechazo);
        return remito;
      });
  }

  /**
   * Numeración `REM-[AÑO]-[5 dígitos]`, reiniciada por año.
   *
   * El lock de aviso serializa la generación entre transacciones concurrentes,
   * y el número sale del máximo ya emitido en el año —no de `count()`— para que
   * borrar un remito no haga que se reutilice un número ya usado.
   */
  private async generarNumeroRemito(manager: EntityManager): Promise<string> {
    const year = new Date().getFullYear();
    await manager.query('SELECT pg_advisory_xact_lock($1)', [year]);

    const prefijo = `REM-${year}-`;
    const filas = await manager.query<{ max: string | null }[]>(
      `SELECT MAX(numero_remito) AS max FROM remitos WHERE numero_remito LIKE $1`,
      [`${prefijo}%`],
    );

    const ultimo = filas[0]?.max ?? null;
    const siguiente = ultimo
      ? parseInt(ultimo.slice(prefijo.length), 10) + 1
      : 1;

    return `${prefijo}${String(siguiente).padStart(5, '0')}`;
  }
}
