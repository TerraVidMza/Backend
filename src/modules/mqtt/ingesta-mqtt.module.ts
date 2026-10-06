import { Module } from '@nestjs/common';
import { MqttModule } from './mqtt.module';
import { IngestaMqttService } from './ingesta-mqtt.service';
import { LecturasIotModule } from '../lecturas-iot/lecturas-iot.module';

/** Suscripción a las lecturas que publican los sensores (D-026). */
@Module({
  imports: [MqttModule, LecturasIotModule],
  providers: [IngestaMqttService],
})
export class IngestaMqttModule {}
