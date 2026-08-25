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
 * Toda consulta de esta tabla es "serie de un sensor en una ventana de tiempo"
 * (historial de HU-19, evaluación de umbrales, correlaciones de HU-32). Sin el
 * índice compuesto cada una es un seq scan sobre la tabla que más crece.
 */
@Entity('lecturas_iot')
@Index('idx_lecturas_iot_sensor_ts', ['sensorId', 'sensorTimestamp'])
export class LecturaIot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sensor_id', type: 'uuid' })
  sensorId: string;

  @ManyToOne(() => Sensor)
  @JoinColumn({ name: 'sensor_id' })
  sensor: Sensor;

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  valor: number;

  @Column({ type: 'varchar', length: 20 })
  unidad: string;

  @Column({ name: 'sensor_timestamp', type: 'timestamptz' })
  sensorTimestamp: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'received_at' })
  receivedAt: Date;
}
