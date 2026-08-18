import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { TicketSoporte } from './entities/ticket-soporte.entity';
import { CrearTicketDto } from './dto/crear-ticket.dto';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { UsuariosService } from '../usuarios/usuarios.service';

@Injectable()
export class TicketSoporteService {
  private readonly logger = new Logger(TicketSoporteService.name);

  constructor(
    @InjectRepository(TicketSoporte)
    private readonly ticketRepository: Repository<TicketSoporte>,
    private readonly configuracionService: ConfiguracionService,
    private readonly usuariosService: UsuariosService,
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

  findAll(): Promise<TicketSoporte[]> {
    return this.ticketRepository.find({ order: { createdAt: 'DESC' }, take: 100 });
  }

  private async intentarEnviarEmail(ticket: TicketSoporte, usuarioId: string): Promise<boolean> {
    try {
      const [host, port, user, pass, from, supportEmail] = await Promise.all([
        this.configuracionService.findByClave('smtp_host'),
        this.configuracionService.findByClave('smtp_port'),
        this.configuracionService.findByClave('smtp_user'),
        this.configuracionService.findByClave('smtp_pass'),
        this.configuracionService.findByClave('smtp_from'),
        this.configuracionService.findByClave('support_email'),
      ]);

      if (!host || !supportEmail) {
        this.logger.warn('SMTP no configurado (smtp_host/support_email); ticket guardado sin notificar por email.');
        return false;
      }

      const usuario = await this.usuariosService.findById(usuarioId);

      const transporter = nodemailer.createTransport({
        host: host.valor,
        port: port ? parseInt(port.valor, 10) : 587,
        secure: false,
        auth: user && pass ? { user: user.valor, pass: pass.valor } : undefined,
      });

      await transporter.sendMail({
        from: from?.valor ?? 'no-reply@terravid.local',
        to: supportEmail.valor,
        subject: `[TerraVid] Nueva consulta de soporte - módulo ${ticket.modulo}`,
        text: [
          `Usuario: ${usuario?.nombre ?? 'desconocido'} (${usuario?.email ?? usuarioId})`,
          `Rol: ${usuario?.rol?.nombreRol ?? 'desconocido'}`,
          `Módulo: ${ticket.modulo}`,
          `Versión de la app: ${ticket.appVersion ?? 'no especificada'}`,
          `Fecha: ${ticket.createdAt.toISOString()}`,
          '',
          'Descripción:',
          ticket.descripcion,
        ].join('\n'),
      });

      return true;
    } catch (error) {
      this.logger.error('No se pudo enviar el email de soporte', error as Error);
      return false;
    }
  }
}
