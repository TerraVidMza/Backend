import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Empresa } from '../../empresas/entities/empresa.entity';

/**
 * Parámetros del sistema por empresa (HU-33).
 *
 * La clave primaria es compuesta `(empresa_id, clave)`: antes era solo `clave`,
 * lo que hacía que la configuración fuera global a la instancia y que un
 * Propietario cambiara el nombre de organización, la moneda o el SMTP de todas
 * las empresas a la vez.
 */
@Entity('configuracion')
export class Configuracion {
  @Column({ name: 'empresa_id', type: 'uuid', primary: true })
  empresaId: string;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'empresa_id' })
  empresa: Empresa;

  @Column({ type: 'varchar', length: 100, primary: true })
  clave: string;

  @Column({ type: 'text' })
  valor: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedById: string | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedBy: Usuario | null;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
