import { Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { AlertasIotService } from './alertas-iot.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolNombre } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('alertas-iot')
export class AlertasIotController {
  constructor(private readonly alertasIotService: AlertasIotService) {}

  @Get('pendientes')
  findPendientes() {
    return this.alertasIotService.findPendientes();
  }

  @Patch(':id/revisar')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  marcarRevisada(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.alertasIotService.marcarRevisada(id, user.id);
  }
}
