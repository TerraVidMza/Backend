import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Cuartel } from '../../cuarteles/entities/cuartel.entity';
import { TipoLabor } from '../../tipo-labor/entities/tipo-labor.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { EstadoSync } from '../../../common/enums/estado-sync.enum';

@Entity('registro_labor')
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

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'synced_at', type: 'timestamptz', nullable: true })
  syncedAt: Date | null;
}
