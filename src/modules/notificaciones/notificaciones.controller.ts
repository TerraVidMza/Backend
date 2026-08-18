import { Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@UseGuards(JwtAuthGuard)
@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get()
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.notificacionesService.findByUsuario(user.id);
  }

  @Patch(':id/leida')
  marcarLeida(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notificacionesService.marcarLeida(id, user.id);
  }

  @Patch('leidas')
  marcarTodasLeidas(@CurrentUser() user: AuthenticatedUser) {
    return this.notificacionesService.marcarTodasLeidas(user.id);
  }
}
