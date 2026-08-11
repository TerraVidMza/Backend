import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RegistroLabor } from './entities/registro-labor.entity';
import { DetalleInsumoLabor } from './entities/detalle-insumo-labor.entity';
import { RegistroLaborService } from './registro-labor.service';
import { RegistroLaborController } from './registro-labor.controller';
import { TipoLaborModule } from '../tipo-labor/tipo-labor.module';
import { InsumosModule } from '../insumos/insumos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RegistroLabor, DetalleInsumoLabor]),
    TipoLaborModule,
    InsumosModule,
  ],
  providers: [RegistroLaborService],
  controllers: [RegistroLaborController],
  exports: [RegistroLaborService],
})
export class RegistroLaborModule {}
