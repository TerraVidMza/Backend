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
import { Usuario } from '../../usuarios/entities/usuario.entity';

export enum EstadoRecomendacion {
  ACTIVA = 'activa',
  APLICADA = 'aplicada',
  DESCARTADA = 'descartada',
}

/**
 * Recomendación agronómica generada por reglas (HU-30).
 *
 * Antes se calculaban al vuelo en cada request y **no tenían `id`**, así que el
 * criterio de "marcar como Aplicada o Descartada" era literalmente inexpresable:
 * no había a qué apuntarle. Persistirlas es lo que las vuelve accionables.
 *
 * Una misma regla **puede volver a generarse** si las condiciones se repiten
 * después de resolverla, tal como pide la HU: el índice parcial garantiza una
 * sola recomendación *activa* por regla y cuartel, pero no limita el histórico.
 * Sin esa unicidad, cada visita a la pantalla generaría un duplicado.
 */
@Entity('recomendaciones')
@Index('uq_recomendacion_activa', ['cuartelId', 'reglaId'], {
  unique: true,
  where: `"estado" = 'activa'`,
})
@Index('idx_recomendaciones_cuartel_estado', ['cuartelId', 'estado'])
export class Recomendacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'cuartel_id', type: 'uuid' })
  cuartelId: string;

  @ManyToOne(() => Cuartel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cuartel_id' })
  cuartel: Cuartel;

  /** Identificador estable de la regla del catálogo (`REGLAS_AGRONOMICAS`). */
  @Column({ name: 'regla_id', type: 'varchar', length: 60 })
  reglaId: string;

  @Column({ type: 'varchar', length: 40 })
  variable: string;

  /** Qué se detectó: el patrón que disparó la regla, ya redactado. */
  @Column({ name: 'patron_detectado', type: 'text' })
  patronDetectado: string;

  /** Qué hacer al respecto. */
  @Column({ name: 'accion_sugerida', type: 'text' })
  accionSugerida: string;

  @Column({ type: 'varchar', length: 10 })
  severidad: string;

  /**
   * Valores concretos que dispararon la regla, congelados al generarla. Sirven
   * para que la recomendación siga siendo legible meses después, cuando las
   * lecturas que la motivaron ya se consolidaron en promedios horarios.
   */
  @Column({ type: 'jsonb', nullable: true })
  evidencia: Record<string, unknown> | null;

  @Column({
    type: 'enum',
    enum: EstadoRecomendacion,
    default: EstadoRecomendacion.ACTIVA,
  })
  estado: EstadoRecomendacion;

  @Column({ type: 'varchar', length: 300, nullable: true })
  nota: string | null;

  @Column({ name: 'resuelta_por', type: 'uuid', nullable: true })
  resueltaPorId: string | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'resuelta_por' })
  resueltaPor: Usuario | null;

  @Column({ name: 'timestamp_estado', type: 'timestamptz', nullable: true })
  timestampEstado: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
