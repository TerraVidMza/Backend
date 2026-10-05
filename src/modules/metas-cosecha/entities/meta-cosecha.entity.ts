import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Kilos que se espera cosechar en un cuartel durante una campaña (D-027).
 *
 * Sale de la estimación de rendimiento que hace el Propietario antes de la
 * vendimia. Alimenta el indicador de avance de cosecha de la app de campo,
 * que antes tenía una meta fija de 10.000 kg escrita en el código.
 */
@Entity('metas_cosecha')
@Unique('uq_meta_cosecha', ['campaniaId', 'cuartelId'])
export class MetaCosecha {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'campania_id', type: 'uuid' })
  campaniaId: string;

  @Column({ name: 'cuartel_id', type: 'uuid' })
  cuartelId: string;

  @Column({ name: 'meta_kg', type: 'decimal', precision: 12, scale: 2 })
  metaKg: number;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedById: string | null;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
