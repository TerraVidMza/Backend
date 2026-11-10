import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cuartel } from './entities/cuartel.entity';
import { CuartelesService } from './cuarteles.service';
import { CuartelesController } from './cuarteles.controller';
import { RegistroLabor } from '../registro-labor/entities/registro-labor.entity';
import { PesajeVendimia } from '../pesaje-vendimia/entities/pesaje-vendimia.entity';
import { GeoModule } from '../../common/geo/geo.module';

@Module({
  // Se registran los repositorios de labores y pesajes —no sus módulos— para
  // poder bloquear la baja de un cuartel con historial sin crear un ciclo:
  // ambos módulos ya dependen de éste.
  imports: [
    TypeOrmModule.forFeature([Cuartel, RegistroLabor, PesajeVendimia]),
    GeoModule,
  ],
  providers: [CuartelesService],
  controllers: [CuartelesController],
  exports: [CuartelesService],
})
export class CuartelesModule {}
