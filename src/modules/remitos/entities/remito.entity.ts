import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Cuartel } from '../../cuarteles/entities/cuartel.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';

export enum EstadoRemito {
  BORRADOR = 'borrador',
  APROBADO = 'aprobado',
  RECHAZADO = 'rechazado',
}

@Entity('remitos')
export class Remito {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'numero_remito', type: 'varchar', length: 20, unique: true })
  numeroRemito: string;

  @Column({ name: 'cuartel_id', type: 'uuid' })
  cuartelId: string;

  @ManyToOne(() => Cuartel)
  @JoinColumn({ name: 'cuartel_id' })
  cuartel: Cuartel;

  @Column({ name: 'generado_por', type: 'uuid' })
  generadoPorId: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'generado_por' })
  generadoPor: Usuario;

  @Column({ name: 'aprobado_por', type: 'uuid', nullable: true })
  aprobadoPorId: string | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'aprobado_por' })
  aprobadoPor: Usuario | null;

  @Column({ name: 'rechazado_por', type: 'uuid', nullable: true })
  rechazadoPorId: string | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'rechazado_por' })
  rechazadoPor: Usuario | null;

  @Column({ type: 'varchar', length: 20, default: EstadoRemito.BORRADOR })
  estado: EstadoRemito;

  @Column({ name: 'total_kg', type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalKg: number | null;

  @Column({ name: 'total_liquidacion', type: 'decimal', precision: 12, scale: 2, nullable: true })
  totalLiquidacion: number | null;

  @Column({ name: 'motivo_rechazo', type: 'text', nullable: true })
  motivoRechazo: string | null;

  @Column({ type: 'date' })
  fecha: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'fecha_generacion' })
  fechaGeneracion: Date;

  @Column({ name: 'fecha_aprobacion', type: 'timestamptz', nullable: true })
  fechaAprobacion: Date | null;

  @Column({ name: 'fecha_rechazo', type: 'timestamptz', nullable: true })
  fechaRechazo: Date | null;
}
