import {
  Check,
  Exclusion,
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

/**
 * Campaña o año agrícola (D-014).
 *
 * El concepto no existía en el modelo y cada indicador resolvía el corte por su
 * cuenta: el dashboard usaba año calendario, HU-31 delegaba los rangos al
 * cliente y la baja de cuartel de HU-09 no acotaba el período. Ya divergían.
 *
 * Se modela como **rango explícito** y no como un mes de corte configurable
 * porque la vendimia no cae siempre en la misma semana: el productor cierra la
 * campaña cuando termina de cosechar, no cuando cambia el almanaque.
 *
 * Las campañas de una empresa **no pueden solaparse**: eso lo garantiza una
 * restricción `EXCLUDE` en la base, no el servicio (ver la migración). Sin esa
 * garantía «la campaña actual» sería ambigua, que es justo el problema que
 * esta entidad viene a resolver.
 */
@Entity('campanias')
@Index('uq_campanias_nombre', ['empresaId', 'nombre'], { unique: true })
@Index('idx_campanias_empresa_rango', ['empresaId', 'fechaDesde', 'fechaHasta'])
@Check('chk_campania_rango', '"fecha_hasta" > "fecha_desde"')
// La restricción vive también acá y no solo en la migración para que
// `migration:generate` no la vea como deriva y la re-emita en cada corrida. La
// expresión está escrita como la normaliza PostgreSQL —con el cast `::text`—
// justamente para que el diff dé vacío.
@Exclusion(
  'excl_campanias_sin_solape',
  `USING gist (empresa_id WITH =, daterange(fecha_desde, fecha_hasta, '[]'::text) WITH &&)`,
)
export class Campania {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId: string;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'empresa_id' })
  empresa: Empresa;

  /** Etiqueta con la que el productor la nombra: "2025/2026", "Vendimia 26". */
  @Column({ type: 'varchar', length: 50 })
  nombre: string;

  @Column({ name: 'fecha_desde', type: 'date' })
  fechaDesde: string;

  /** Inclusivo: el último día que pertenece a la campaña. */
  @Column({ name: 'fecha_hasta', type: 'date' })
  fechaHasta: string;

  /**
   * Una campaña cerrada sigue siendo consultable y comparable, pero deja de ser
   * «la actual» aunque hoy caiga dentro de su rango. Es lo que permite terminar
   * la vendimia antes de que se agote el rango sin que los indicadores sigan
   * sumando al período viejo.
   */
  @Column({ type: 'boolean', default: false })
  cerrada: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at', nullable: true })
  updatedAt: Date | null;
}
