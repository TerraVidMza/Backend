import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sensor } from './entities/sensor.entity';
import { SensoresService } from './sensores.service';
import { SensoresController } from './sensores.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Sensor])],
  providers: [SensoresService],
  controllers: [SensoresController],
  exports: [SensoresService],
})
export class SensoresModule {}
