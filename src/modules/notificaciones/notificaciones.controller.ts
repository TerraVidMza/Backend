import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { ListarNotificacionesDto } from './dto/listar-notificaciones.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AnyRole } from '../../common/decorators/any-role.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

// Cada usuario opera solo sobre sus propias notificaciones (el service filtra
// por usuarioId), así que el rol no cambia el alcance.
@AnyRole()
@UseGuards(JwtAuthGuard)
@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get()
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListarNotificacionesDto,
  ) {
    return this.notificacionesService.findByUsuario(user.id, query);
  }

  @Patch(':id/leida')
  marcarLeida(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificacionesService.marcarLeida(id, user.id);
  }

  @Patch('leidas')
  marcarTodasLeidas(@CurrentUser() user: AuthenticatedUser) {
    return this.notificacionesService.marcarTodasLeidas(user.id);
  }
}
