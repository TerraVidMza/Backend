import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketSoporte } from './entities/ticket-soporte.entity';
import { CrearTicketDto } from './dto/crear-ticket.dto';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { MailService } from '../../common/mail/mail.service';

@Injectable()
export class TicketSoporteService {
  private readonly logger = new Logger(TicketSoporteService.name);

  constructor(
    @InjectRepository(TicketSoporte)
    private readonly ticketRepository: Repository<TicketSoporte>,
    private readonly configuracionService: ConfiguracionService,
    private readonly usuariosService: UsuariosService,
    private readonly mailService: MailService,
  ) {}

  async crear(dto: CrearTicketDto, usuarioId: string): Promise<TicketSoporte> {
    const ticket = this.ticketRepository.create({
      usuarioId,
      modulo: dto.modulo,
      descripcion: dto.descripcion,
      appVersion: dto.appVersion ?? null,
      emailEnviado: false,
    });
    const guardado = await this.ticketRepository.save(ticket);

    const emailEnviado = await this.intentarEnviarEmail(guardado, usuarioId);
    if (emailEnviado) {
      guardado.emailEnviado = true;
      await this.ticketRepository.save(guardado);
    }

    return guardado;
  }

  /** Solo los tickets de usuarios de la empresa del solicitante. */
  findAll(empresaId: string): Promise<TicketSoporte[]> {
    return this.ticketRepository.find({
      where: { usuario: { empresaId } },
      relations: { usuario: true },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  /**
   * Notifica el ticket a la casilla de soporte de la empresa (HU-36).
   *
   * El armado del transport vive ahora en `MailService`: acá quedaba duplicado
   * y era la única parte del sistema que sabía mandar correo, así que el resto
   * de las notificaciones por mail de las HU simplemente no existían.
   */
  private async intentarEnviarEmail(
    ticket: TicketSoporte,
    usuarioId: string,
  ): Promise<boolean> {
    const usuario = await this.usuariosService.findById(usuarioId);
    if (!usuario) {
      this.logger.warn(
        'No se pudo resolver el usuario del ticket; se guarda sin notificar.',
      );
      return false;
    }

    const { empresaId } = usuario;
    const supportEmail = await this.configuracionService.getValorInterno(
      'support_email',
      empresaId,
    );
    if (!supportEmail) {
      this.logger.warn(
        'Sin `support_email` configurado: ticket guardado sin notificar.',
      );
      return false;
    }

    return this.mailService.enviar(
      {
        para: supportEmail,
        asunto: `[TerraVid] Nueva consulta de soporte - módulo ${ticket.modulo}`,
        texto: [
          `Usuario: ${usuario.nombre} (${usuario.email})`,
          `Rol: ${usuario.rol?.nombreRol ?? 'desconocido'}`,
          `Módulo: ${ticket.modulo}`,
          `Versión de la app: ${ticket.appVersion ?? 'no especificada'}`,
          `Fecha: ${ticket.createdAt.toISOString()}`,
          '',
          'Descripción:',
          ticket.descripcion,
        ].join('\n'),
      },
      empresaId,
    );
  }
}
