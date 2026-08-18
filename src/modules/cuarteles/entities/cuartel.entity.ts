import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Finca } from '../../fincas/entities/finca.entity';
import { CatalogoItem } from '../../catalogo-item/entities/catalogo-item.entity';

@Entity('cuarteles')
export class Cuartel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'finca_id', type: 'uuid' })
  fincaId: string;

  @ManyToOne(() => Finca)
  @JoinColumn({ name: 'finca_id' })
  finca: Finca;

  @Column({ name: 'variedad_id', type: 'uuid' })
  variedadId: string;

  @ManyToOne(() => CatalogoItem)
  @JoinColumn({ name: 'variedad_id' })
  variedad: CatalogoItem;

  @Column({ name: 'sistema_conduccion_id', type: 'uuid' })
  sistemaConduccionId: string;

  @ManyToOne(() => CatalogoItem)
  @JoinColumn({ name: 'sistema_conduccion_id' })
  sistemaConduccion: CatalogoItem;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  clon: string | null;

  @Column({ name: 'anio_implantacion', type: 'smallint', nullable: true })
  anioImplantacion: number | null;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  hectareas: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  estado: string | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at', nullable: true })
  updatedAt: Date | null;
}
