import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertaIot } from './entities/alerta-iot.entity';
import { Sensor } from '../sensores/entities/sensor.entity';
import { AlertasIotService } from './alertas-iot.service';
import { AlertasIotController } from './alertas-iot.controller';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [TypeOrmModule.forFeature([AlertaIot, Sensor]), UsuariosModule, NotificacionesModule],
  providers: [AlertasIotService],
  controllers: [AlertasIotController],
  exports: [AlertasIotService],
})
export class AlertasIotModule {}
