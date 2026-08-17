import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PesajeVendimia } from './entities/pesaje-vendimia.entity';
import { PesajeVendimiaService } from './pesaje-vendimia.service';
import { PesajeVendimiaController } from './pesaje-vendimia.controller';
import { CuadrillasModule } from '../cuadrillas/cuadrillas.module';

@Module({
  imports: [TypeOrmModule.forFeature([PesajeVendimia]), CuadrillasModule],
  providers: [PesajeVendimiaService],
  controllers: [PesajeVendimiaController],
  exports: [PesajeVendimiaService],
})
export class PesajeVendimiaModule {}
