import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Cuartel } from '../../cuarteles/entities/cuartel.entity';
import { TipoLabor } from '../../tipo-labor/entities/tipo-labor.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { DetalleInsumoLabor } from './detalle-insumo-labor.entity';
import { EstadoSync } from '../../../common/enums/estado-sync.enum';

/** El costeo de HU-15 filtra por cuartel y rango de fechas en cada consulta. */
@Entity('registro_labor')
@Index('idx_registro_labor_cuartel_fecha', ['cuartelId', 'fecha'])
@Check('chk_registro_labor_cantidad_positiva', '"cantidad" > 0')
export class RegistroLabor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'local_uuid', type: 'uuid', unique: true })
  localUuid: string;

  @Column({ name: 'cuartel_id', type: 'uuid' })
  cuartelId: string;

  @ManyToOne(() => Cuartel)
  @JoinColumn({ name: 'cuartel_id' })
  cuartel: Cuartel;

  @Column({ name: 'tipo_labor_id', type: 'uuid' })
  tipoLaborId: string;

  @ManyToOne(() => TipoLabor)
  @JoinColumn({ name: 'tipo_labor_id' })
  tipoLabor: TipoLabor;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ type: 'date' })
  fecha: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  cantidad: number;

  @Column({
    name: 'costo_unitario_al_sync',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  costoUnitarioAlSync: number | null;

  @Column({
    name: 'estado_sync',
    type: 'varchar',
    length: 20,
    default: EstadoSync.SINCRONIZADO,
  })
  estadoSync: EstadoSync;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  /**
   * Lado inverso: no agrega columna, solo permite pedir los insumos de la
   * labor en la misma consulta en vez de una query por fila del historial.
   */
  @OneToMany(() => DetalleInsumoLabor, (detalle) => detalle.registroLabor)
  detalles: DetalleInsumoLabor[];

  /**
   * Momento en que el dispositivo creó el registro, que puede ser días anterior
   * al `created_at` del servidor si se trabajó sin señal. HU-14 ordena los lotes
   * por este campo, y sin él el orden real de los hechos en la finca se pierde.
   */
  @Column({ name: 'created_at_local', type: 'timestamptz', nullable: true })
  createdAtLocal: Date | null;

  /**
   * El registro usa un ítem de catálogo dado de baja después de la última
   * descarga del dispositivo (HU-14). Se acepta igual —el trabajo físico
   * ocurrió— pero queda marcado para que el Propietario lo revise.
   */
  @Column({ name: 'inconsistencia_catalogo', type: 'boolean', default: false })
  inconsistenciaCatalogo: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'synced_at', type: 'timestamptz', nullable: true })
  syncedAt: Date | null;

  /** Ubicación del teléfono al registrar (D-027); null si no hubo GPS. */
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitud: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitud: number | null;
}
