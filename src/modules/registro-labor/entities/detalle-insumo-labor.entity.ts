import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RegistroLabor } from './registro-labor.entity';
import { Insumo } from '../../insumos/entities/insumo.entity';

@Entity('detalle_insumo_labor')
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
