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
import { Finca } from '../../fincas/entities/finca.entity';

/**
 * El nombre es único **por finca y entre activas** (HU-23): dos fincas pueden
 * tener su "Cuadrilla 1", y dar de baja una no puede bloquear ese nombre para
 * siempre.
 */
@Entity('cuadrillas')
@Index('uq_cuadrillas_nombre_activa', ['fincaId', 'nombre'], {
  unique: true,
  where: '"activa" = true',
})
export class Cuadrilla {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'finca_id', type: 'uuid' })
  fincaId: string;

  @ManyToOne(() => Finca)
  @JoinColumn({ name: 'finca_id' })
  finca: Finca;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ name: 'cantidad_integrantes', type: 'smallint' })
  cantidadIntegrantes: number;

  @Column({ type: 'boolean', default: true })
  activa: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at', nullable: true })
  updatedAt: Date | null;
}
