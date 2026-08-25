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
import { Remito } from './remito.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';

/**
 * Liquidación que la bodega paga por un remito de uva entregado (D-005).
 *
 * **Es la única fuente de ingreso del sistema.** Hasta acá el margen bruto era
 * inexpresable: el `monto_liquidacion` de un pesaje es lo que se le paga a la
 * cuadrilla —un costo de cosecha—, y usarlo como ingreso daba un indicador sin
 * sentido económico y de signo arbitrario.
 *
 * Cuelga del remito y no del cuartel porque el remito **ya es** el documento de
 * despacho a la bodega (HU-27), y la cadena `remito → pesajes → cuartel` deja el
 * ingreso atribuido a un cuartel concreto sin necesidad de prorratear nada.
 *
 * Los kilos aceptados pueden diferir de los despachados: la bodega descuenta
 * por materia extraña, sanidad o diferencia de balanza. Se guardan los dos.
 */
@Entity('liquidaciones_bodega')
@Index('uq_liquidacion_remito', ['remitoId'], { unique: true })
@Check('chk_liquidacion_kg_positivos', '"kg_aceptados" > 0')
@Check('chk_liquidacion_precio_positivo', '"precio_por_kg" > 0')
export class LiquidacionBodega {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Un remito se liquida una sola vez: el UNIQUE lo garantiza. Una corrección
   * posterior se registra editando esta fila, que queda auditada.
   */
  @Column({ name: 'remito_id', type: 'uuid', unique: true })
  remitoId: string;

  @ManyToOne(() => Remito, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'remito_id' })
  remito: Remito;

  /** Nombre de la bodega compradora. */
  @Column({ type: 'varchar', length: 150 })
  bodega: string;

  /** Kilos que la bodega reconoce, que pueden ser menos que los despachados. */
  @Column({ name: 'kg_aceptados', type: 'decimal', precision: 10, scale: 2 })
  kgAceptados: number;

  @Column({ name: 'precio_por_kg', type: 'decimal', precision: 12, scale: 4 })
  precioPorKg: number;

  /** Descuentos aplicados por la bodega (calidad, flete, adelantos). */
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  descuentos: number;

  /**
   * `kg_aceptados × precio_por_kg − descuentos`, calculado en el servicio con
   * redondeo explícito a 2 decimales. Se persiste en vez de derivarse en cada
   * consulta para que el ingreso histórico no cambie si más adelante cambia la
   * fórmula, con el mismo criterio append-only que los costos.
   */
  @Column({ name: 'monto_neto', type: 'decimal', precision: 14, scale: 2 })
  montoNeto: number;

  /** Fecha de la liquidación, que suele ser semanas posterior a la entrega. */
  @Column({ type: 'date' })
  fecha: string;

  @Column({
    name: 'numero_comprobante',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  numeroComprobante: string | null;

  @Column({ name: 'registrado_por', type: 'uuid' })
  registradoPorId: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'registrado_por' })
  registradoPor: Usuario;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
