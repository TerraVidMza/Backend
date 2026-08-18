import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Cuadrilla } from './cuadrilla.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity('tarifa_cuadrilla')
export class TarifaCuadrilla {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'cuadrilla_id', type: 'uuid' })
  cuadrillaId: string;

  @ManyToOne(() => Cuadrilla)
  @JoinColumn({ name: 'cuadrilla_id' })
  cuadrilla: Cuadrilla;

  @Column({ name: 'tarifa_por_kg', type: 'decimal', precision: 10, scale: 4 })
  tarifaPorKg: number;

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
