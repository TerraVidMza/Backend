import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Sensor } from '../../sensores/entities/sensor.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity('umbral_sensor')
export class UmbralSensor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sensor_id', type: 'uuid', unique: true })
  sensorId: string;

  @ManyToOne(() => Sensor)
  @JoinColumn({ name: 'sensor_id' })
  sensor: Sensor;

  @Column({ name: 'umbral_minimo', type: 'decimal', precision: 10, scale: 4, nullable: true })
  umbralMinimo: number | null;

  @Column({ name: 'umbral_maximo', type: 'decimal', precision: 10, scale: 4, nullable: true })
  umbralMaximo: number | null;

  @Column({ name: 'configurado_por', type: 'uuid' })
  configuradoPorId: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'configurado_por' })
  configuradoPor: Usuario;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
