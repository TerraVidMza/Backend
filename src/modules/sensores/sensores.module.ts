import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sensor } from './entities/sensor.entity';
import { SensoresService } from './sensores.service';
import { SensoresController } from './sensores.controller';
import { MqttModule } from '../mqtt/mqtt.module';

@Module({
  imports: [TypeOrmModule.forFeature([Sensor]), MqttModule],
  providers: [SensoresService],
  controllers: [SensoresController],
  exports: [SensoresService],
})
export class SensoresModule {}
