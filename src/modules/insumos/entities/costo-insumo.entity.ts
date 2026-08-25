import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Insumo } from './insumo.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';

/**
 * Versionado append-only (HU-16). El UNIQUE es lo que hace determinista al
 * "costo vigente a la fecha": con dos filas de la misma fecha el resultado
 * depende del plan de ejecución. La validación en el service no alcanza —dos
 * requests concurrentes la pasan las dos.
 */
@Entity('costo_insumo')
@Unique('uq_costo_insumo_vigencia', ['insumoId', 'validFrom'])
export class CostoInsumo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'insumo_id', type: 'uuid' })
  insumoId: string;

  @ManyToOne(() => Insumo)
  @JoinColumn({ name: 'insumo_id' })
  insumo: Insumo;

  @Column({ name: 'costo_unitario', type: 'decimal', precision: 12, scale: 2 })
  costoUnitario: number;

  @Column({ name: 'valid_from', type: 'date' })
  validFrom: string;

  @Column({ name: 'created_by', type: 'uuid' })
  createdById: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'created_by' })
  createdBy: Usuario;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
