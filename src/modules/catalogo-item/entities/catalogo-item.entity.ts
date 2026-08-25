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
import { Empresa } from '../../empresas/entities/empresa.entity';

export enum CatalogoTipo {
  VARIEDAD = 'variedad',
  SISTEMA_CONDUCCION = 'sistema_conduccion',
  ESTADO_CUARTEL = 'estado_cuartel',
  UNIDAD_MEDIDA = 'unidad_medida',
}

@Entity('catalogo_item')
@Index('uq_catalogo_item_nombre_activo', ['empresaId', 'tipo', 'nombre'], {
  unique: true,
  where: '"activo" = true',
})
export class CatalogoItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Cada empresa mantiene su propio catálogo (D-h).
   *
   * Sin esta columna las tablas maestras eran globales a la instancia: un
   * Propietario que corregía el costo de un insumo lo cambiaba **para todas las
   * empresas**, y el ABM de HU-34 operaba sobre datos de terceros sin saberlo.
   */
  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId: string;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'empresa_id' })
  empresa: Empresa;

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
