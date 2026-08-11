import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity('notificaciones')
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
