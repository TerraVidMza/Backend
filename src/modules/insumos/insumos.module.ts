import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Insumo } from './entities/insumo.entity';
import { CostoInsumo } from './entities/costo-insumo.entity';
import { InsumosService } from './insumos.service';
import { InsumosController } from './insumos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Insumo, CostoInsumo])],
  providers: [InsumosService],
  controllers: [InsumosController],
  exports: [InsumosService],
})
export class InsumosModule {}
