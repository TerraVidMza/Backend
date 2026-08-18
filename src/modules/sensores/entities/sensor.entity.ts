import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Finca } from '../../fincas/entities/finca.entity';

export enum SensorTipo {
  TEMPERATURA = 'temperatura',
  HUMEDAD_SUELO = 'humedad_suelo',
  HUMEDAD_AMBIENTE = 'humedad_ambiente',
  PLUVIOMETRO = 'pluviometro',
  RADIACION_SOLAR = 'radiacion_solar',
  VIENTO = 'viento',
}

@Entity('sensores')
export class Sensor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'finca_id', type: 'uuid' })
  fincaId: string;

  @ManyToOne(() => Finca)
  @JoinColumn({ name: 'finca_id' })
  finca: Finca;

  @Column({ type: 'varchar', length: 50, unique: true })
  codigo: string;

  @Column({ type: 'varchar', length: 30 })
  tipo: SensorTipo;

  @Column({ type: 'varchar', length: 200, nullable: true })
  descripcion: string | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
