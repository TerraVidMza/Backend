import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('roles')
export class Rol {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'nombre_rol', type: 'varchar', length: 50, unique: true })
  nombreRol: string;
}
