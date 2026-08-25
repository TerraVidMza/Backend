import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Rol } from '../../roles/entities/rol.entity';
import { Empresa } from '../../empresas/entities/empresa.entity';

/**
 * El listado de usuarios de HU-04 siempre acota por empresa y filtra por
 * estado; `activo` solo no discrimina lo suficiente para justificar un índice.
 */
@Entity('usuarios')
@Index('idx_usuarios_empresa_activo', ['empresaId', 'activo'])
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Exclude()
  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId: string;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'empresa_id' })
  empresa: Empresa;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  /**
   * Se marca al crear el usuario con contraseña temporal (HU-05). El cliente lo
   * usa para forzar el cambio en el primer ingreso; se limpia al fijar una
   * contraseña propia, sea por reset o por cambio con la actual.
   */
  @Column({ name: 'debe_cambiar_password', type: 'boolean', default: false })
  debeCambiarPassword: boolean;

  @Column({ name: 'intentos_fallidos', type: 'smallint', default: 0 })
  intentosFallidos: number;

  @Column({ name: 'bloqueado_hasta', type: 'timestamptz', nullable: true })
  bloqueadoHasta: Date | null;

  @Column({ name: 'ultimo_acceso', type: 'timestamptz', nullable: true })
  ultimoAcceso: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at', nullable: true })
  updatedAt: Date | null;

  @Column({ name: 'rol_id', type: 'uuid' })
  rolId: string;

  @ManyToOne(() => Rol, { eager: true })
  @JoinColumn({ name: 'rol_id' })
  rol: Rol;
}
