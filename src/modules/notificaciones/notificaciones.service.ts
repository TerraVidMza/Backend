import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, LessThan, Repository } from 'typeorm';
import { Notificacion } from './entities/notificacion.entity';
import {
  DeviceToken,
  PlataformaDispositivo,
} from './entities/device-token.entity';
import { PushService } from '../../common/push/push.service';
import { ListarNotificacionesDto } from './dto/listar-notificaciones.dto';
import {
  armarResultado,
  calcularPaginacion,
  ResultadoPaginado,
} from '../../common/dto/pagination-query.dto';

interface CrearNotificacionParams {
  usuarioId: string;
  tipo: string;
  titulo: string;
  descripcion: string;
  urlAccion?: string | null;
}

@Injectable()
export class NotificacionesService {
  constructor(
    @InjectRepository(Notificacion)
    private readonly notificacionRepository: Repository<Notificacion>,
    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepository: Repository<DeviceToken>,
    private readonly pushService: PushService,
  ) {}

  /**
   * Crea la notificación in-app y dispara el push (HU-35).
   *
   * El push sale **después** de persistir y sin `await`: la notificación in-app
   * es la fuente de verdad y no puede depender de que FCM responda. Con `await`,
   * una latencia de Firebase se sumaría al tiempo de respuesta de la operación
   * que la disparó —ingerir una lectura, aprobar un remito—.
   */
  async crear(params: CrearNotificacionParams): Promise<Notificacion> {
    const notificacion = this.notificacionRepository.create({
      usuarioId: params.usuarioId,
      tipo: params.tipo,
      titulo: params.titulo,
      descripcion: params.descripcion,
      urlAccion: params.urlAccion ?? null,
      leida: false,
    });
    const guardada = await this.notificacionRepository.save(notificacion);

    void this.pushService.enviar({
      usuarioId: params.usuarioId,
      tipo: params.tipo,
      titulo: params.titulo,
      descripcion: params.descripcion,
      urlAccion: params.urlAccion ?? null,
    });

    return guardada;
  }

  /**
   * Alta idempotente del token de dispositivo (HU-35).
   *
   * La app reenvía su token en cada arranque y FCM lo rota cada tanto, así que
   * el alta tiene que poder repetirse sin acumular filas. Si el token ya existía
   * contra otro usuario se reasigna: un teléfono compartido no puede seguir
   * recibiendo los avisos del capataz anterior.
   */
  async registrarDeviceToken(
    usuarioId: string,
    token: string,
    plataforma: PlataformaDispositivo,
  ): Promise<DeviceToken> {
    const existente = await this.deviceTokenRepository.findOne({
      where: { token },
    });
    if (existente) {
      existente.usuarioId = usuarioId;
      existente.plataforma = plataforma;
      existente.activo = true;
      return this.deviceTokenRepository.save(existente);
    }

    return this.deviceTokenRepository.save(
      this.deviceTokenRepository.create({
        usuarioId,
        token,
        plataforma,
        activo: true,
      }),
    );
  }

  /**
   * Baja del token al cerrar sesión. Se desactiva y no se borra, para que quede
   * el rastro del dispositivo; el alta posterior lo reactiva.
   */
  async bajaDeviceToken(usuarioId: string, token: string): Promise<void> {
    await this.deviceTokenRepository.update(
      { usuarioId, token },
      { activo: false },
    );
  }

  /**
   * Notificaciones del usuario, paginadas (HU-35).
   *
   * Devuelve además `noLeidas`, que es el número del badge: sin él el cliente
   * tenía que traerse la lista completa solo para contar.
   */
  async findByUsuario(
    usuarioId: string,
    query: ListarNotificacionesDto = {},
  ): Promise<ResultadoPaginado<Notificacion> & { noLeidas: number }> {
    const { page, pageSize, skip, take } = calcularPaginacion(query);

    const where: FindOptionsWhere<Notificacion> = { usuarioId };
    if (query.soloNoLeidas) {
      where.leida = false;
    }

    const [resultado, noLeidas] = await Promise.all([
      this.notificacionRepository.findAndCount({
        where,
        order: { createdAt: 'DESC' },
        skip,
        take,
      }),
      this.notificacionRepository.count({ where: { usuarioId, leida: false } }),
    ]);

    return { ...armarResultado(resultado, page, pageSize), noLeidas };
  }

  /**
   * Purga las notificaciones de más de `dias` días (HU-35).
   *
   * La tabla crece con cada alerta de sensor y no tiene ciclo de vida propio:
   * sin la purga es la que más crece del sistema.
   */
  async purgarAntiguas(dias = 30): Promise<number> {
    const corte = new Date();
    corte.setDate(corte.getDate() - dias);
    const resultado = await this.notificacionRepository.delete({
      createdAt: LessThan(corte),
    });
    return resultado.affected ?? 0;
  }

  async marcarLeida(id: string, usuarioId: string): Promise<void> {
    await this.notificacionRepository.update(
      { id, usuarioId },
      { leida: true },
    );
  }

  async marcarTodasLeidas(usuarioId: string): Promise<void> {
    await this.notificacionRepository.update(
      { usuarioId, leida: false },
      { leida: true },
    );
  }
}
