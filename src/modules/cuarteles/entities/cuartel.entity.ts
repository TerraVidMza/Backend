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
   * Centroide del cuartel para el mapa de HU-10, que sin estas columnas no
   * tenía dónde poner los marcadores.
   *
   * `decimal(10,7)` da ~1 cm de resolución, de sobra para un cuartel. Se
   * modelan como columnas y no como `geometry` de PostGIS a propósito: hoy no
   * hay ninguna consulta espacial, y un punto suelto no la justifica. Si más
   * adelante hacen falta polígonos o consultas por proximidad, ahí sí conviene
   * migrar a PostGIS —la extensión ya está instalada—.
   */
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitud: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitud: number | null;

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
