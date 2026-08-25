import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Cuadrilla } from '../../cuadrillas/entities/cuadrilla.entity';
import { Cuartel } from '../../cuarteles/entities/cuartel.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Remito } from '../../remitos/entities/remito.entity';
import { EstadoSync } from '../../../common/enums/estado-sync.enum';
import { EstadoPesaje } from './estado-pesaje.enum';

/**
 * El CHECK respalda en base el `@Min(0.01)` del DTO: un pesaje de 0 o negativo
 * entra a un remito y desvía la liquidación.
 */
@Entity('pesajes_vendimia')
@Index('idx_pesajes_cuartel_estado', ['cuartelId', 'estado'])
@Index('idx_pesajes_remito', ['remitoId'])
@Check('chk_pesaje_kg_positivos', '"kg_totales" > 0')
export class PesajeVendimia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'local_uuid', type: 'uuid', unique: true })
  localUuid: string;

  @Column({ name: 'cuadrilla_id', type: 'uuid' })
  cuadrillaId: string;

  @ManyToOne(() => Cuadrilla)
  @JoinColumn({ name: 'cuadrilla_id' })
  cuadrilla: Cuadrilla;

  @Column({ name: 'cuartel_id', type: 'uuid' })
  cuartelId: string;

  @ManyToOne(() => Cuartel)
  @JoinColumn({ name: 'cuartel_id' })
  cuartel: Cuartel;

  @Column({ name: 'registrado_por', type: 'uuid' })
  registradoPorId: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'registrado_por' })
  registradoPor: Usuario;

  @Column({ name: 'remito_id', type: 'uuid', nullable: true })
  remitoId: string | null;

  @ManyToOne(() => Remito, { nullable: true })
  @JoinColumn({ name: 'remito_id' })
  remito: Remito | null;

  @Column({ type: 'date' })
  fecha: string;

  @Column({ name: 'kg_totales', type: 'decimal', precision: 10, scale: 2 })
  kgTotales: number;

  @Column({
    name: 'tarifa_utilizada',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  tarifaUtilizada: number | null;

  @Column({
    name: 'monto_liquidacion',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  montoLiquidacion: number | null;

  @Column({
    name: 'estado_sync',
    type: 'varchar',
    length: 20,
    default: EstadoSync.SINCRONIZADO,
  })
  estadoSync: EstadoSync;

  /**
   * Motivo del fallo cuando `estado_sync = error`, para que el Capataz pueda
   * corregir el registro y reintentar (mismo criterio que `registro_labor`).
   */
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: EstadoPesaje.PENDIENTE_REMITO,
  })
  estado: EstadoPesaje;

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
}
