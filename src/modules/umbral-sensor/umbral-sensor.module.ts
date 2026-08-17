import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UmbralSensor } from './entities/umbral-sensor.entity';
import { UmbralSensorService } from './umbral-sensor.service';
import { UmbralSensorController } from './umbral-sensor.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UmbralSensor])],
  providers: [UmbralSensorService],
  controllers: [UmbralSensorController],
  exports: [UmbralSensorService],
})
export class UmbralSensorModule {}
