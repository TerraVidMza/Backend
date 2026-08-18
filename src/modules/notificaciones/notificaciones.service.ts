import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notificacion } from './entities/notificacion.entity';

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

  findByUsuario(usuarioId: string): Promise<Notificacion[]> {
    return this.notificacionRepository.find({
      where: { usuarioId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async marcarLeida(id: string, usuarioId: string): Promise<void> {
    await this.notificacionRepository.update({ id, usuarioId }, { leida: true });
  }

  async marcarTodasLeidas(usuarioId: string): Promise<void> {
    await this.notificacionRepository.update({ usuarioId, leida: false }, { leida: true });
  }
}
