import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Finca } from '../../modules/fincas/entities/finca.entity';
import { Cuartel } from '../../modules/cuarteles/entities/cuartel.entity';
import { Sensor } from '../../modules/sensores/entities/sensor.entity';
import { Cuadrilla } from '../../modules/cuadrillas/entities/cuadrilla.entity';
import { TipoLabor } from '../../modules/tipo-labor/entities/tipo-labor.entity';
import { Insumo } from '../../modules/insumos/entities/insumo.entity';
import { AlcanceEmpresaService } from './alcance-empresa.service';

/**
 * Global a propósito: la verificación de tenant la necesitan casi todos los
 * módulos de dominio, y declararla global evita que agregar un módulo nuevo y
 * olvidarse el import deje un endpoint sin control de pertenencia.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Finca,
      Cuartel,
      Sensor,
      Cuadrilla,
      TipoLabor,
      Insumo,
    ]),
  ],
  providers: [AlcanceEmpresaService],
  exports: [AlcanceEmpresaService],
})
export class AlcanceEmpresaModule {}
