import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Remito } from './entities/remito.entity';
import { PesajeVendimia } from '../pesaje-vendimia/entities/pesaje-vendimia.entity';
import { RemitosService } from './remitos.service';
import { RemitosController } from './remitos.controller';
import { Cuartel } from '../cuarteles/entities/cuartel.entity';
import { LiquidacionBodega } from './entities/liquidacion-bodega.entity';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { UsuariosModule } from '../usuarios/usuarios.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Remito,
      PesajeVendimia,
      Cuartel,
      LiquidacionBodega,
    ]),
    NotificacionesModule,
    UsuariosModule,
  ],
  providers: [RemitosService],
  controllers: [RemitosController],
  exports: [RemitosService],
})
export class RemitosModule {}
