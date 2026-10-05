import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { MailModule } from './common/mail/mail.module';
import { PushModule } from './common/push/push.module';
import { TareasProgramadasModule } from './common/tareas/tareas-programadas.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import typeormConfig from './config/typeorm.config';
import { validarEntorno } from './config/validar-entorno';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AlcanceEmpresaModule } from './common/tenant/alcance-empresa.module';
import { AuditoriaInterceptor } from './common/audit/auditoria.interceptor';
import { RequestContextMiddleware } from './common/audit/request-context.middleware';

import { RolesModule } from './modules/roles/roles.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { AuthModule } from './modules/auth/auth.module';
import { LogAuditoriaModule } from './modules/log-auditoria/log-auditoria.module';
import { TokenRecuperacionModule } from './modules/token-recuperacion/token-recuperacion.module';
import { EmpresasModule } from './modules/empresas/empresas.module';
import { IngestaMqttModule } from './modules/mqtt/ingesta-mqtt.module';
import { FincasModule } from './modules/fincas/fincas.module';
import { CuartelesModule } from './modules/cuarteles/cuarteles.module';
import { CatalogoItemModule } from './modules/catalogo-item/catalogo-item.module';
import { InsumosModule } from './modules/insumos/insumos.module';
import { TipoLaborModule } from './modules/tipo-labor/tipo-labor.module';
import { RegistroLaborModule } from './modules/registro-labor/registro-labor.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module';
import { SensoresModule } from './modules/sensores/sensores.module';
import { UmbralSensorModule } from './modules/umbral-sensor/umbral-sensor.module';
import { AlertasIotModule } from './modules/alertas-iot/alertas-iot.module';
import { LecturasIotModule } from './modules/lecturas-iot/lecturas-iot.module';
import { CuadrillasModule } from './modules/cuadrillas/cuadrillas.module';
import { PesajeVendimiaModule } from './modules/pesaje-vendimia/pesaje-vendimia.module';
import { RemitosModule } from './modules/remitos/remitos.module';
import { ConfiguracionModule } from './modules/configuracion/configuracion.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { InteligenciaAgronomicaModule } from './modules/inteligencia-agronomica/inteligencia-agronomica.module';
import { AyudaModule } from './modules/ayuda/ayuda.module';
import { CampaniasModule } from './modules/campanias/campanias.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [typeormConfig],
      // Corta el arranque nombrando la variable que falta. Sin esto el fallo
      // llega cuando alguien ejerce el camino que la usa, con un error que no
      // la menciona.
      validate: validarEntorno,
    }),
    TypeOrmModule.forRootAsync({
      inject: [typeormConfig.KEY],
      useFactory: (config: ReturnType<typeof typeormConfig>) => config,
    }),
    // Límite general por IP. Los endpoints sensibles de auth lo ajustan con
    // `@Throttle` (HU-01, HU-03).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    // Desacopla del camino de respuesta el trabajo que no le importa a quien
    // hizo el request (evaluar umbrales, notificar). Es la alternativa sin
    // Redis a BullMQ que documenta `D-g`: in-process, así que un reinicio
    // pierde los eventos en vuelo — aceptable para esto, no para una cola real.
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    AlcanceEmpresaModule,
    MailModule,
    PushModule,
    TareasProgramadasModule,
    CampaniasModule,
    RolesModule,
    UsuariosModule,
    AuthModule,
    LogAuditoriaModule,
    TokenRecuperacionModule,
    EmpresasModule,
    IngestaMqttModule,
    FincasModule,
    CuartelesModule,
    CatalogoItemModule,
    InsumosModule,
    TipoLaborModule,
    RegistroLaborModule,
    NotificacionesModule,
    SensoresModule,
    UmbralSensorModule,
    AlertasIotModule,
    LecturasIotModule,
    CuadrillasModule,
    PesajeVendimiaModule,
    RemitosModule,
    ConfiguracionModule,
    DashboardModule,
    InteligenciaAgronomicaModule,
    AyudaModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Después de los guards: audita solo lo que pasó autenticación y permisos.
    { provide: APP_INTERCEPTOR, useClass: AuditoriaInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
