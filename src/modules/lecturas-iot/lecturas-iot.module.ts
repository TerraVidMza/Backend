import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LecturaIot } from './entities/lectura-iot.entity';
import { LecturaIotHistorico } from './entities/lectura-iot-historico.entity';
import { LecturaAnomala } from './entities/lectura-anomala.entity';
import { LecturasIotService } from './lecturas-iot.service';
import { LecturasIotController } from './lecturas-iot.controller';
import { SensoresModule } from '../sensores/sensores.module';
import { UmbralSensorModule } from '../umbral-sensor/umbral-sensor.module';
import { AlertasIotModule } from '../alertas-iot/alertas-iot.module';
import { ConfiguracionModule } from '../configuracion/configuracion.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LecturaIot, LecturaIotHistorico, LecturaAnomala]),
    SensoresModule,
    UmbralSensorModule,
    AlertasIotModule,
    ConfiguracionModule,
  ],
  providers: [LecturasIotService],
  controllers: [LecturasIotController],
  exports: [LecturasIotService],
})
export class LecturasIotModule {}
