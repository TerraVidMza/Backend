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
import { Empresa } from '../../empresas/entities/empresa.entity';

/**
 * La unicidad del nombre es **entre activos** (HU-16): con un UNIQUE plano, dar
 * de baja un registro dejaba su nombre bloqueado para siempre, aunque ya no
 * apareciera en ningún listado. El índice parcial de PostgreSQL expresa eso
 * exactamente.
 */
@Entity('tipo_labor')
@Index('uq_tipo_labor_nombre_activo', ['empresaId', 'nombre'], {
  unique: true,
  where: '"activo" = true',
})
export class TipoLabor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Cada empresa mantiene su propio catálogo (D-h).
   *
   * Sin esta columna las tablas maestras eran globales a la instancia: un
   * Propietario que corregía el costo de un insumo lo cambiaba **para todas las
   * empresas**, y el ABM de HU-34 operaba sobre datos de terceros sin saberlo.
   */
  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId: string;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'empresa_id' })
  empresa: Empresa;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  descripcion: string | null;

  @Column({ name: 'unidad_medida', type: 'varchar', length: 20 })
  unidadMedida: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at', nullable: true })
  updatedAt: Date | null;
}
