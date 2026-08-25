import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';

/**
 * El listado de HU-35 es "las mías, no leídas primero, más recientes arriba";
 * la purga nocturna barre por `created_at`.
 */
@Entity('notificaciones')
@Index('idx_notificaciones_usuario', ['usuarioId', 'leida', 'createdAt'])
@Index('idx_notificaciones_created_at', ['createdAt'])
export class Notificacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ type: 'varchar', length: 50 })
  tipo: string;

  @Column({ type: 'varchar', length: 200 })
  titulo: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ name: 'url_accion', type: 'varchar', length: 500, nullable: true })
  urlAccion: string | null;

  @Column({ type: 'boolean', default: false })
  leida: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
