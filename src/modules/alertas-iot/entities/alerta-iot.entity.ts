import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Sensor } from '../../sensores/entities/sensor.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';

export enum TipoAlerta {
  UMBRAL_MINIMO = 'umbral_minimo',
  UMBRAL_MAXIMO = 'umbral_maximo',
}

export enum EstadoAlerta {
  PENDIENTE = 'pendiente',
  REVISADA = 'revisada',
}

@Entity('alertas_iot')
export class AlertaIot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sensor_id', type: 'uuid' })
  sensorId: string;

  @ManyToOne(() => Sensor)
  @JoinColumn({ name: 'sensor_id' })
  sensor: Sensor;

  @Column({ name: 'tipo_alerta', type: 'varchar', length: 20 })
  tipoAlerta: TipoAlerta;

  @Column({ name: 'valor_lectura', type: 'decimal', precision: 10, scale: 4 })
  valorLectura: number;

  @Column({ name: 'umbral_superado', type: 'decimal', precision: 10, scale: 4 })
  umbralSuperado: number;

  @Column({ name: 'timestamp_lectura', type: 'timestamptz' })
  timestampLectura: Date;

  @Column({ type: 'varchar', length: 20, default: EstadoAlerta.PENDIENTE })
  estado: EstadoAlerta;

  @Column({ name: 'revisada_por', type: 'uuid', nullable: true })
  revisadaPorId: string | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'revisada_por' })
  revisadaPor: Usuario | null;

  @Column({ name: 'revisada_at', type: 'timestamptz', nullable: true })
  revisadaAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
