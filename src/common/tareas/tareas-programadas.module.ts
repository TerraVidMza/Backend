import { Module } from '@nestjs/common';
import { TareasProgramadasService } from './tareas-programadas.service';
import { NotificacionesModule } from '../../modules/notificaciones/notificaciones.module';
import { TokenRecuperacionModule } from '../../modules/token-recuperacion/token-recuperacion.module';
import { LecturasIotModule } from '../../modules/lecturas-iot/lecturas-iot.module';
import { TokenRevocadoModule } from '../../modules/auth/token-revocado.module';

@Module({
  imports: [
    NotificacionesModule,
    TokenRecuperacionModule,
    TokenRevocadoModule,
    LecturasIotModule,
  ],
  providers: [TareasProgramadasService],
})
export class TareasProgramadasModule {}
