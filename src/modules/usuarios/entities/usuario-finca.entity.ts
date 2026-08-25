import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Usuario } from './usuario.entity';
import { Finca } from '../../fincas/entities/finca.entity';

/**
 * Asignación de un usuario a una finca, **usada solo para enrutar avisos**.
 *
 * HU-22 pide que la alerta de un sensor llegue a los Propietarios y Agrónomos
 * *de la finca afectada*, no de toda la empresa. Sin esta tabla el criterio era
 * inexpresable: `Usuario` solo conocía su empresa.
 *
 * **No participa del control de acceso.** El alcance de datos sigue siendo por
 * empresa (`AlcanceEmpresaService`), que es lo que las HU especifican hoy y lo
 * que está verificado. Usarla también para filtrar lecturas atravesaría todos
 * los listados y ninguna HU lo pide.
 *
 * Regla de interpretación deliberada: **sin ninguna asignación, el usuario
 * recibe los avisos de todas las fincas de su empresa**. Así el sistema sigue
 * notificando a quien corresponde mientras nadie configure nada, en vez de
 * dejar de avisar en silencio —que es el modo de falla peligroso acá—.
 */
@Entity('usuario_finca')
@Index('idx_usuario_finca_finca', ['fincaId'])
export class UsuarioFinca {
  @PrimaryColumn({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @PrimaryColumn({ name: 'finca_id', type: 'uuid' })
  fincaId: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @ManyToOne(() => Finca, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'finca_id' })
  finca: Finca;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
