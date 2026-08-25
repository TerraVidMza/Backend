import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from './entities/usuario.entity';
import { UsuarioFinca } from './entities/usuario-finca.entity';
import { Finca } from '../fincas/entities/finca.entity';
import { Rol } from '../roles/entities/rol.entity';
import { UsuariosService } from './usuarios.service';
import { UsuariosController } from './usuarios.controller';
import { TokenRecuperacionModule } from '../token-recuperacion/token-recuperacion.module';

@Module({
  // `TokenRecuperacionModule` para el enlace de bienvenida de HU-05.
  imports: [
    TypeOrmModule.forFeature([Usuario, UsuarioFinca, Finca, Rol]),
    TokenRecuperacionModule,
  ],
  providers: [UsuariosService],
  controllers: [UsuariosController],
  exports: [UsuariosService],
})
export class UsuariosModule {}
