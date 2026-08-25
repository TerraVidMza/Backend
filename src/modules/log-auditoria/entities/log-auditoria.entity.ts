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
 * Append-only y de crecimiento indefinido: el listado de HU-05 ordena por
 * `created_at DESC` y filtra por actor, entidad y rango de fechas.
 */
@Entity('log_auditoria')
@Index('idx_log_auditoria_created_at', ['createdAt'])
@Index('idx_log_auditoria_actor', ['actorId'])
@Index('idx_log_auditoria_entidad', ['entidad', 'entidadId'])
export class LogAuditoria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'actor_id' })
  actor: Usuario;

  @Column({ type: 'varchar', length: 50 })
  accion: string;

  @Column({ type: 'varchar', length: 50 })
  entidad: string;

  @Column({ name: 'entidad_id', type: 'uuid', nullable: true })
  entidadId: string | null;

  @Column({ name: 'datos_anteriores', type: 'jsonb', nullable: true })
  datosAnteriores: Record<string, unknown> | null;

  @Column({ name: 'datos_nuevos', type: 'jsonb', nullable: true })
  datosNuevos: Record<string, unknown> | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
