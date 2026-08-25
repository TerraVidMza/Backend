import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Sensor } from '../../sensores/entities/sensor.entity';

/**
 * Lecturas descartadas por caer fuera del rango físico de su variable (HU-19).
 *
 * Van a una tabla aparte y no a `lecturas_iot` con un flag: así ninguna
 * consulta de negocio puede incluirlas por olvidarse un `WHERE`, que es
 * exactamente el problema que tenían los registros en `estado_sync = error`
 * antes de la Fase 1. Sirven para diagnosticar hardware descalibrado, no para
 * calcular nada.
 */
@Entity('lecturas_anomalas')
@Index('idx_lecturas_anomalas_sensor', ['sensorId', 'sensorTimestamp'])
export class LecturaAnomala {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sensor_id', type: 'uuid' })
  sensorId: string;

  @ManyToOne(() => Sensor)
  @JoinColumn({ name: 'sensor_id' })
  sensor: Sensor;

  @Column({ type: 'decimal', precision: 12, scale: 4 })
  valor: number;

  @Column({ type: 'varchar', length: 20 })
  unidad: string;

  @Column({ name: 'sensor_timestamp', type: 'timestamptz' })
  sensorTimestamp: Date;

  /** Por qué se descartó: rango esperado y valor recibido. */
  @Column({ type: 'text' })
  motivo: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'received_at' })
  receivedAt: Date;
}
