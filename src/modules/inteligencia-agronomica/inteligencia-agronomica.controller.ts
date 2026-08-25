import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InteligenciaAgronomicaService } from './inteligencia-agronomica.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolNombre } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AlcanceEmpresaService } from '../../common/tenant/alcance-empresa.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

// Todos los endpoints cruzan costos con telemetría, así que quedan restringidos
// a los roles que HU-29/30/31 declaran como actores.
@Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
@UseGuards(JwtAuthGuard)
@Controller('inteligencia-agronomica')
export class InteligenciaAgronomicaController {
  constructor(
    private readonly inteligenciaAgronomicaService: InteligenciaAgronomicaService,
    private readonly alcance: AlcanceEmpresaService,
  ) {}

  @Get('correlacion/:cuartelId')
  async correlacion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cuartelId', ParseUUIDPipe) cuartelId: string,
    @Query('sensorId', ParseUUIDPipe) sensorId: string,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
  ) {
    // Se verifican los dos: si no, se podría cruzar el sensor de una empresa
    // con los costos de un cuartel de otra.
    await this.alcance.verificarCuartel(cuartelId, user.empresaId);
    await this.alcance.verificarSensor(sensorId, user.empresaId);
    return this.inteligenciaAgronomicaService.correlacionSensorCostos(
      cuartelId,
      sensorId,
      desde,
      hasta,
      user.empresaId,
    );
  }

  @Get('recomendaciones/:cuartelId')
  async recomendaciones(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cuartelId', ParseUUIDPipe) cuartelId: string,
  ) {
    await this.alcance.verificarCuartel(cuartelId, user.empresaId);
    return this.inteligenciaAgronomicaService.getRecomendaciones(cuartelId);
  }

  @Get('comparar-campanias/:cuartelId')
  async compararCampanias(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cuartelId', ParseUUIDPipe) cuartelId: string,
    @Query('desde1') desde1: string,
    @Query('hasta1') hasta1: string,
    @Query('desde2') desde2: string,
    @Query('hasta2') hasta2: string,
  ) {
    await this.alcance.verificarCuartel(cuartelId, user.empresaId);
    return this.inteligenciaAgronomicaService.compararCampanias(
      cuartelId,
      desde1,
      hasta1,
      desde2,
      hasta2,
    );
  }
}
