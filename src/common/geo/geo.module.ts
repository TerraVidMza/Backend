import { Module } from '@nestjs/common';
import { GeoService } from './geo.service';

/** Cálculos espaciales (PostGIS) compartidos por fincas y cuarteles. */
@Module({
  providers: [GeoService],
  exports: [GeoService],
})
export class GeoModule {}
