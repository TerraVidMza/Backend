import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Finca } from './entities/finca.entity';
import { FincasService } from './fincas.service';
import { FincasController } from './fincas.controller';
import { CuartelesModule } from '../cuarteles/cuarteles.module';

@Module({
  imports: [TypeOrmModule.forFeature([Finca]), CuartelesModule],
  providers: [FincasService],
  controllers: [FincasController],
  exports: [FincasService],
})
export class FincasModule {}
