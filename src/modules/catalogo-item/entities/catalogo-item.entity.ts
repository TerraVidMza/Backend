import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum CatalogoTipo {
  VARIEDAD = 'variedad',
  SISTEMA_CONDUCCION = 'sistema_conduccion',
  ESTADO_CUARTEL = 'estado_cuartel',
  UNIDAD_MEDIDA = 'unidad_medida',
}

@Entity('catalogo_item')
export class CatalogoItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  tipo: CatalogoTipo;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at', nullable: true })
  updatedAt: Date | null;
}
