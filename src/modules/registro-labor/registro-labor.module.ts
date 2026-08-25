import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RegistroLabor } from './entities/registro-labor.entity';
import { DetalleInsumoLabor } from './entities/detalle-insumo-labor.entity';
import { RegistroLaborService } from './registro-labor.service';
import { RegistroLaborController } from './registro-labor.controller';
import { TipoLaborModule } from '../tipo-labor/tipo-labor.module';
import { InsumosModule } from '../insumos/insumos.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RegistroLabor, DetalleInsumoLabor]),
    TipoLaborModule,
    InsumosModule,
    // Para avisarle al Capataz que su lote quedó en error (HU-35).
    NotificacionesModule,
  ],
  providers: [RegistroLaborService],
  controllers: [RegistroLaborController],
  exports: [RegistroLaborService],
})
export class RegistroLaborModule {}
