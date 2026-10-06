import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Refresh tokens emitidos (D-023).
 *
 * El refresh token es un valor opaco de 256 bits: no es un JWT y no lleva
 * datos. En la base se guarda solo su SHA-256, así una copia de la tabla no
 * sirve para abrir sesiones. Con esa entropía alcanza un hash rápido; bcrypt
 * haría lenta una consulta que se resuelve por índice único.
 *
 * Cada uso lo **rota**: el token presentado se marca como revocado y se emite
 * uno nuevo de la misma `familia`. Si alguien presenta un token ya rotado, es
 * porque el valor se filtró (lo usaron el dueño y otra persona): se revoca la
 * familia completa y las dos sesiones tienen que volver a loguearse.
 */
@Entity('refresh_token')
@Index('idx_refresh_token_familia', ['familiaId'])
@Index('idx_refresh_token_usuario', ['usuarioId'])
@Index('idx_refresh_token_expira', ['expiresAt'])
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** SHA-256 en hexadecimal del valor entregado al cliente. */
  @Index('uq_refresh_token_hash', { unique: true })
  @Column({ name: 'token_hash', type: 'char', length: 64 })
  tokenHash: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  /** Sesión a la que pertenece: todas las rotaciones de un mismo login. */
  @Column({ name: 'familia_id', type: 'uuid' })
  familiaId: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  /** Momento en que dejó de servir (rotación, logout o reuso detectado). */
  @Column({ name: 'revocado_at', type: 'timestamptz', nullable: true })
  revocadoAt: Date | null;

  /**
   * Token que lo reemplazó al rotar. Distingue una rotación (que tiene una
   * ventana de gracia) de un logout o una revocación por reuso.
   */
  @Column({ name: 'reemplazado_por_id', type: 'uuid', nullable: true })
  reemplazadoPorId: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
