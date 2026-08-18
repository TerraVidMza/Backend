import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { InteligenciaAgronomicaService } from './inteligencia-agronomica.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('inteligencia-agronomica')
export class InteligenciaAgronomicaController {
  constructor(private readonly inteligenciaAgronomicaService: InteligenciaAgronomicaService) {}

  @Get('correlacion/:cuartelId')
  correlacion(
    @Param('cuartelId', ParseUUIDPipe) cuartelId: string,
    @Query('sensorId', ParseUUIDPipe) sensorId: string,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
  ) {
    return this.inteligenciaAgronomicaService.correlacionSensorCostos(cuartelId, sensorId, desde, hasta);
  }

  @Get('recomendaciones/:cuartelId')
  recomendaciones(@Param('cuartelId', ParseUUIDPipe) cuartelId: string) {
    return this.inteligenciaAgronomicaService.getRecomendaciones(cuartelId);
  }

  @Get('comparar-campanias/:cuartelId')
  compararCampanias(
    @Param('cuartelId', ParseUUIDPipe) cuartelId: string,
    @Query('desde1') desde1: string,
    @Query('hasta1') hasta1: string,
    @Query('desde2') desde2: string,
    @Query('hasta2') hasta2: string,
  ) {
    return this.inteligenciaAgronomicaService.compararCampanias(cuartelId, desde1, hasta1, desde2, hasta2);
  }
}
