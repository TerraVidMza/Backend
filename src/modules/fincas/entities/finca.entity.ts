import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Empresa } from '../../empresas/entities/empresa.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { PoligonoGeoJson, SRID_WGS84 } from '../../../common/geo/poligono';

@Entity('fincas')
export class Finca {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  ubicacion: string | null;

  @Column({ type: 'decimal', precision: 8, scale: 2 })
  hectareas: number;

  @Column({ type: 'boolean', default: true })
  activa: boolean;

  @Column({ name: 'created_by', type: 'uuid' })
  createdById: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'created_by' })
  createdBy: Usuario;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at', nullable: true })
  updatedAt: Date | null;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId: string;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'empresa_id' })
  empresa: Empresa;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitud: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitud: number | null;

  /**
   * Contorno de la finca (PostGIS). Opcional: las fincas anteriores a los
   * polígonos siguen con su punto y sus hectáreas cargadas a mano.
   *
   * Cuando existe, `hectareas`, `latitud` y `longitud` se **derivan** de él (ver
   * `GeoService`), para que no haya dos verdades. TypeORM lo lee y lo escribe
   * como GeoJSON.
   */
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Polygon',
    srid: SRID_WGS84,
    nullable: true,
  })
  poligono: PoligonoGeoJson | null;
}
