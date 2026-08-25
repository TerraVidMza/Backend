import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UmbralSensorService } from './umbral-sensor.service';
import { SetUmbralDto } from './dto/set-umbral.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolNombre } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AlcanceEmpresaService } from '../../common/tenant/alcance-empresa.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Auditar } from '../../common/audit/auditar.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sensores/:sensorId/umbral')
export class UmbralSensorController {
  constructor(
    private readonly umbralSensorService: UmbralSensorService,
    private readonly alcance: AlcanceEmpresaService,
  ) {}

  @Get()
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  async findBySensor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sensorId', ParseUUIDPipe) sensorId: string,
  ) {
    await this.alcance.verificarSensor(sensorId, user.empresaId);
    return this.umbralSensorService.findBySensor(sensorId);
  }

  @Put()
  @Auditar({ accion: 'CONFIGURAR_UMBRAL', entidad: 'umbral_sensor' })
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  async setUmbral(
    @Param('sensorId', ParseUUIDPipe) sensorId: string,
    @Body() dto: SetUmbralDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.alcance.verificarSensor(sensorId, user.empresaId);
    return this.umbralSensorService.setUmbral(sensorId, dto, user.id);
  }
}
