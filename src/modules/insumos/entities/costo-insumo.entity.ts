import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Insumo } from './insumo.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity('costo_insumo')
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
