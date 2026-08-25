import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';

export enum PlataformaDispositivo {
  ANDROID = 'android',
  IOS = 'ios',
  WEB = 'web',
}

/**
 * Token de dispositivo para el push de FCM (HU-35, D-015).
 *
 * El token lo emite Firebase en el cliente y **puede rotar**: la app lo reenvía
 * en cada arranque, así que el alta es idempotente por `token`.
 *
 * Un mismo token puede cambiar de usuario —un teléfono compartido entre dos
 * capataces— y por eso la unicidad es del token y no del par usuario+token: si
 * no, el dispositivo seguiría recibiendo los avisos del usuario anterior.
 */
@Entity('device_tokens')
@Index('uq_device_token', ['token'], { unique: true })
@Index('idx_device_tokens_usuario', ['usuarioId', 'activo'])
export class DeviceToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  /** Registration token de FCM. Largo y variable según plataforma y versión. */
  @Column({ type: 'varchar', length: 512 })
  token: string;

  @Column({ type: 'enum', enum: PlataformaDispositivo })
  plataforma: PlataformaDispositivo;

  /**
   * Se apaga cuando FCM responde que el token ya no es válido, en vez de
   * borrarlo: deja rastro de que el dispositivo existió y evita reintentar
   * contra un token muerto en cada envío.
   */
  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @Column({ name: 'ultimo_uso', type: 'timestamptz', nullable: true })
  ultimoUso: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at', nullable: true })
  updatedAt: Date | null;
}
