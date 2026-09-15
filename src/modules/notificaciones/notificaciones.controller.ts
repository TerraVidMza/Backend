import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { ListarNotificacionesDto } from './dto/listar-notificaciones.dto';
import {
  BajaDeviceTokenDto,
  RegistrarDeviceTokenDto,
} from './dto/device-token.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AnyRole } from '../../common/decorators/any-role.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

// Cada usuario opera solo sobre sus propias notificaciones (el service filtra
// por usuarioId), así que el rol no cambia el alcance.
@AnyRole()
@UseGuards(JwtAuthGuard)
@ApiTags('Dashboard y configuración')
@ApiBearerAuth('jwt')
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

  /**
   * Alta del dispositivo para push (HU-35). La app lo llama en cada arranque:
   * el token de FCM rota, así que reenviarlo es lo normal, no un error.
   */
  @Post('device-token')
  registrarDeviceToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegistrarDeviceTokenDto,
  ) {
    return this.notificacionesService.registrarDeviceToken(
      user.id,
      dto.token,
      dto.plataforma,
    );
  }

  /** Baja al cerrar sesión, para que el teléfono deje de recibir sus avisos. */
  @Delete('device-token')
  @HttpCode(204)
  async bajaDeviceToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BajaDeviceTokenDto,
  ) {
    await this.notificacionesService.bajaDeviceToken(user.id, dto.token);
  }
}
