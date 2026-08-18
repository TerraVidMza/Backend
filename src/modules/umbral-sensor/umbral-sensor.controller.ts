import { Body, Controller, Get, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';
import { UmbralSensorService } from './umbral-sensor.service';
import { SetUmbralDto } from './dto/set-umbral.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolNombre } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sensores/:sensorId/umbral')
export class UmbralSensorController {
  constructor(private readonly umbralSensorService: UmbralSensorService) {}

  @Get()
  findBySensor(@Param('sensorId', ParseUUIDPipe) sensorId: string) {
    return this.umbralSensorService.findBySensor(sensorId);
  }

  @Put()
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  setUmbral(
    @Param('sensorId', ParseUUIDPipe) sensorId: string,
    @Body() dto: SetUmbralDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.umbralSensorService.setUmbral(sensorId, dto, user.id);
  }
}
