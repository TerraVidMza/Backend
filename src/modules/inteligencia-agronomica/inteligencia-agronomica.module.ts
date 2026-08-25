import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cuartel } from '../cuarteles/entities/cuartel.entity';
import { Sensor } from '../sensores/entities/sensor.entity';
import { LecturaIot } from '../lecturas-iot/entities/lectura-iot.entity';
import { AlertaIot } from '../alertas-iot/entities/alerta-iot.entity';
import { RegistroLabor } from '../registro-labor/entities/registro-labor.entity';
import { DetalleInsumoLabor } from '../registro-labor/entities/detalle-insumo-labor.entity';
import { PesajeVendimia } from '../pesaje-vendimia/entities/pesaje-vendimia.entity';
import { LiquidacionBodega } from '../remitos/entities/liquidacion-bodega.entity';
import { Recomendacion } from './entities/recomendacion.entity';
import { InteligenciaAgronomicaService } from './inteligencia-agronomica.service';
import { InteligenciaAgronomicaController } from './inteligencia-agronomica.controller';
import { ConfiguracionModule } from '../configuracion/configuracion.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cuartel,
      Sensor,
      LecturaIot,
      AlertaIot,
      RegistroLabor,
      DetalleInsumoLabor,
      PesajeVendimia,
      LiquidacionBodega,
      Recomendacion,
    ]),
    ConfiguracionModule,
  ],
  providers: [InteligenciaAgronomicaService],
  controllers: [InteligenciaAgronomicaController],
})
export class InteligenciaAgronomicaModule {}
