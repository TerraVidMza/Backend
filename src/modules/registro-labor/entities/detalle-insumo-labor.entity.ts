import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { RegistroLabor } from './registro-labor.entity';
import { Insumo } from '../../insumos/entities/insumo.entity';

/**
 * El UNIQUE es el respaldo en base de la validación de F1-5: un insumo
 * repetido en la misma labor duplica el costo en silencio.
 */
@Entity('detalle_insumo_labor')
@Unique('uq_detalle_insumo_labor', ['registroLaborId', 'insumoId'])
@Check('chk_detalle_cantidad_positiva', '"cantidad_usada" > 0')
export class DetalleInsumoLabor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'registro_labor_id', type: 'uuid' })
  registroLaborId: string;

  @ManyToOne(() => RegistroLabor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'registro_labor_id' })
  registroLabor: RegistroLabor;

  @Column({ name: 'insumo_id', type: 'uuid' })
  insumoId: string;

  @ManyToOne(() => Insumo)
  @JoinColumn({ name: 'insumo_id' })
  insumo: Insumo;

  @Column({ name: 'cantidad_usada', type: 'decimal', precision: 10, scale: 4 })
  cantidadUsada: number;

  @Column({
    name: 'costo_unitario_al_sync',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  costoUnitarioAlSync: number | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
