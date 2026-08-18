import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Cuadrilla } from '../../cuadrillas/entities/cuadrilla.entity';
import { Cuartel } from '../../cuarteles/entities/cuartel.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Remito } from '../../remitos/entities/remito.entity';
import { EstadoSync } from '../../../common/enums/estado-sync.enum';

@Entity('pesajes_vendimia')
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

  @Column({ name: 'tarifa_utilizada', type: 'decimal', precision: 10, scale: 4, nullable: true })
  tarifaUtilizada: number | null;

  @Column({ name: 'monto_liquidacion', type: 'decimal', precision: 12, scale: 2, nullable: true })
  montoLiquidacion: number | null;

  @Column({ name: 'estado_sync', type: 'varchar', length: 20, default: EstadoSync.SINCRONIZADO })
  estadoSync: EstadoSync;

  @Column({ type: 'varchar', length: 20, default: 'pendiente_remito' })
  estado: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'syncod_at', type: 'timestamptz', nullable: true })
  syncedAt: Date | null;
}
