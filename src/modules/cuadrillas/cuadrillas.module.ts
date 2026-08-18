import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cuadrilla } from './entities/cuadrilla.entity';
import { TarifaCuadrilla } from './entities/tarifa-cuadrilla.entity';
import { CuadrillasService } from './cuadrillas.service';
import { CuadrillasController } from './cuadrillas.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Cuadrilla, TarifaCuadrilla])],
  providers: [CuadrillasService],
  controllers: [CuadrillasController],
  exports: [CuadrillasService],
})
export class CuadrillasModule {}
