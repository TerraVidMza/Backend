import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Tokens invalidados antes de su vencimiento natural (HU-02).
 *
 * Un JWT es autocontenido: sin una lista de revocación, "cerrar sesión" no
 * puede hacer nada más que borrarlo del cliente, y un token robado sigue siendo
 * válido las 8 horas completas. Se guarda el `jti` —no el token— porque alcanza
 * para identificarlo y no reproduce el secreto en la base.
 *
 * Solo crece durante la vigencia de los tokens: un cron borra las filas cuyo
 * `expires_at` ya pasó, porque a partir de ahí el JWT se rechaza solo.
 */
@Entity('token_revocado')
@Index('idx_token_revocado_expira', ['expiresAt'])
export class TokenRevocado {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** `jti` del JWT revocado. */
  @Index('idx_token_revocado_jti', { unique: true })
  @Column({ type: 'uuid', unique: true })
  jti: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  /** Vencimiento original del token: hasta cuándo hay que recordar el bloqueo. */
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
