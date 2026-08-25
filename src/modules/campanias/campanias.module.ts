import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campania } from './entities/campania.entity';
import { CampaniasService } from './campanias.service';
import { CampaniasController } from './campanias.controller';

/**
 * `@Global` porque la campaña es el eje temporal de casi todos los indicadores
 * —dashboard, comparación entre campañas, baja de cuartel— y el import olvidado
 * en un módulo nuevo fallaría recién en runtime, al inyectar.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Campania])],
  providers: [CampaniasService],
  controllers: [CampaniasController],
  exports: [CampaniasService],
})
export class CampaniasModule {}
