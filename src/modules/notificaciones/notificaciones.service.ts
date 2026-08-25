import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, LessThan, Repository } from 'typeorm';
import { Notificacion } from './entities/notificacion.entity';
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
  ) {}

  async crear(params: CrearNotificacionParams): Promise<Notificacion> {
    const notificacion = this.notificacionRepository.create({
      usuarioId: params.usuarioId,
      tipo: params.tipo,
      titulo: params.titulo,
      descripcion: params.descripcion,
      urlAccion: params.urlAccion ?? null,
      leida: false,
    });
    return this.notificacionRepository.save(notificacion);
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
