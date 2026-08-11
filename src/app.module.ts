import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import typeormConfig from './config/typeorm.config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

import { RolesModule } from './modules/roles/roles.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { AuthModule } from './modules/auth/auth.module';
import { LogAuditoriaModule } from './modules/log-auditoria/log-auditoria.module';
import { TokenRecuperacionModule } from './modules/token-recuperacion/token-recuperacion.module';
import { EmpresasModule } from './modules/empresas/empresas.module';
import { FincasModule } from './modules/fincas/fincas.module';
import { CuartelesModule } from './modules/cuarteles/cuarteles.module';
import { CatalogoItemModule } from './modules/catalogo-item/catalogo-item.module';
import { InsumosModule } from './modules/insumos/insumos.module';
import { TipoLaborModule } from './modules/tipo-labor/tipo-labor.module';
import { RegistroLaborModule } from './modules/registro-labor/registro-labor.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [typeormConfig] }),
    TypeOrmModule.forRootAsync({
      inject: [typeormConfig.KEY],
      useFactory: (config: ReturnType<typeof typeormConfig>) => config,
    }),
    RolesModule,
    UsuariosModule,
    AuthModule,
    LogAuditoriaModule,
    TokenRecuperacionModule,
    EmpresasModule,
    FincasModule,
    CuartelesModule,
    CatalogoItemModule,
    InsumosModule,
    TipoLaborModule,
    RegistroLaborModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
