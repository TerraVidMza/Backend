import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Finca } from '../fincas/entities/finca.entity';
import { Cuartel } from '../cuarteles/entities/cuartel.entity';
import { AlertaIot } from '../alertas-iot/entities/alerta-iot.entity';
import { RegistroLabor } from '../registro-labor/entities/registro-labor.entity';
import { DetalleInsumoLabor } from '../registro-labor/entities/detalle-insumo-labor.entity';
import { PesajeVendimia } from '../pesaje-vendimia/entities/pesaje-vendimia.entity';
import { Remito } from '../remitos/entities/remito.entity';
import { UsuarioFinca } from '../usuarios/entities/usuario-finca.entity';
import { LogAuditoriaModule } from '../log-auditoria/log-auditoria.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Finca,
      Cuartel,
      AlertaIot,
      RegistroLabor,
      DetalleInsumoLabor,
      PesajeVendimia,
      Remito,
      UsuarioFinca,
    ]),
    LogAuditoriaModule,
  ],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
