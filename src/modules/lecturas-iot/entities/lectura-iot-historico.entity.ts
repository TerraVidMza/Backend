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

@Entity('lecturas_iot_historico')
@Index('idx_lecturas_hist_sensor_fecha', ['sensorId', 'fechaHora'])
export class LecturaIotHistorico {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sensor_id', type: 'uuid' })
  sensorId: string;

  @ManyToOne(() => Sensor)
  @JoinColumn({ name: 'sensor_id' })
  sensor: Sensor;

  @Column({ name: 'valor_promedio', type: 'decimal', precision: 10, scale: 4 })
  valorPromedio: number;

  @Column({ type: 'varchar', length: 20 })
  unidad: string;

  @Column({ name: 'fecha_hora', type: 'timestamptz' })
  fechaHora: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
