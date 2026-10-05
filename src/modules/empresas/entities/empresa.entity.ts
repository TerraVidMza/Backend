import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity('empresas')
export class Empresa {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  cuit: string;

  /** Una empresa desactivada no puede iniciar ni renovar sesiones (D-025). */
  @Column({ type: 'boolean', default: true })
  activa: boolean;

  /**
   * La empresa a la que pertenecen los Administradores de plataforma (D-025).
   * No es un cliente: no aparece en el listado de empresas ni tiene datos.
   */
  @Column({ name: 'es_plataforma', type: 'boolean', default: false })
  esPlataforma: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById: string | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: Usuario | null;
}
