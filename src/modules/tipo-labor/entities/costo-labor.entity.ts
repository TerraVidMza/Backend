import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TipoLabor } from './tipo-labor.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity('costo_labor')
export class CostoLabor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tipo_labor_id', type: 'uuid' })
  tipoLaborId: string;

  @ManyToOne(() => TipoLabor)
  @JoinColumn({ name: 'tipo_labor_id' })
  tipoLabor: TipoLabor;

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
