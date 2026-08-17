import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Sensor } from '../../sensores/entities/sensor.entity';

@Entity('lecturas_iot')
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
