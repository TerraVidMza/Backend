import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { ModuloAyuda } from './articulo-ayuda.entity';

export enum EstadoTicket {
  ABIERTO = 'abierto',
  CERRADO = 'cerrado',
}

@Entity('tickets_soporte')
export class TicketSoporte {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ type: 'varchar', length: 30 })
  modulo: ModuloAyuda;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ name: 'app_version', type: 'varchar', length: 30, nullable: true })
  appVersion: string | null;

  @Column({ type: 'varchar', length: 20, default: EstadoTicket.ABIERTO })
  estado: EstadoTicket;

  @Column({ name: 'email_enviado', type: 'boolean', default: false })
  emailEnviado: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
