import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AnyRole } from '../../common/decorators/any-role.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // Accesible a todos los roles, pero el contenido varía según el rol: es el
  // service el que decide qué indicadores corresponden a cada uno (HU-32).
  @AnyRole()
  @Get('indicadores')
  getIndicadores(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getIndicadoresClave(user.empresaId, user.rol);
  }
}
