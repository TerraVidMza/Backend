import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TipoLabor } from './entities/tipo-labor.entity';
import { CostoLabor } from './entities/costo-labor.entity';
import { TipoLaborService } from './tipo-labor.service';
import { TipoLaborController } from './tipo-labor.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TipoLabor, CostoLabor])],
  providers: [TipoLaborService],
  controllers: [TipoLaborController],
  exports: [TipoLaborService],
})
export class TipoLaborModule {}
