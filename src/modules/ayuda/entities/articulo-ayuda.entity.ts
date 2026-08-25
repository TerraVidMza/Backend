import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TipoArticulo {
  MANUAL = 'manual',
  FAQ = 'faq',
}

export enum ModuloAyuda {
  AUTENTICACION = 'autenticacion',
  FINCAS = 'fincas',
  OPERACIONES = 'operaciones',
  TELEMETRIA = 'telemetria',
  VENDIMIA = 'vendimia',
  REPORTES = 'reportes',
}

@Entity('articulos_ayuda')
export class ArticuloAyuda {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  tipo: TipoArticulo;

  @Column({ type: 'varchar', length: 30 })
  modulo: ModuloAyuda;

  @Column({ type: 'varchar', length: 200 })
  titulo: string;

  @Column({ type: 'text' })
  contenido: string;

  @Column({ type: 'smallint', default: 0 })
  orden: number;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at', nullable: true })
  updatedAt: Date | null;
}
