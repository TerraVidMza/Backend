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
import { EstadoCuartel } from './estado-cuartel.enum';
import { PoligonoGeoJson, SRID_WGS84 } from '../../../common/geo/poligono';

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

  /**
   * Punto representativo del cuartel para el marcador del mapa de HU-10.
   *
   * `decimal(10,7)` da ~1 cm de resolución, de sobra para un cuartel. Se
   * mantienen como columnas aunque ahora exista `poligono`: el mapa y la app
   * móvil ya las consumen, y los cuarteles sin polígono solo tienen esto. Cuando
   * hay polígono se **derivan** de él (un punto garantizado dentro del
   * contorno), no se cargan a mano.
   */
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitud: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitud: number | null;

  /**
   * Contorno del cuartel (PostGIS). Opcional: los cuarteles anteriores a los
   * polígonos siguen con su punto y sus hectáreas cargadas a mano. Cuando
   * existe, `hectareas`, `latitud` y `longitud` salen de él. TypeORM lo lee y
   * lo escribe como GeoJSON.
   */
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Polygon',
    srid: SRID_WGS84,
    nullable: true,
  })
  poligono: PoligonoGeoJson | null;

  /**
   * Estado en el ciclo de vendimia. Lo mantiene el sistema a partir de los
   * pesajes y los remitos (HU-28); no se edita desde el ABM de cuarteles, por
   * eso no está en `CreateCuartelDto`.
   */
  @Column({
    type: 'varchar',
    length: 20,
    default: EstadoCuartel.PENDIENTE,
  })
  estado: EstadoCuartel;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at', nullable: true })
  updatedAt: Date | null;
}
