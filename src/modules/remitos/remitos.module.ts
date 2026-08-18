import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Remito } from './entities/remito.entity';
import { PesajeVendimia } from '../pesaje-vendimia/entities/pesaje-vendimia.entity';
import { RemitosService } from './remitos.service';
import { RemitosController } from './remitos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Remito, PesajeVendimia])],
  providers: [RemitosService],
  controllers: [RemitosController],
  exports: [RemitosService],
})
export class RemitosModule {}
