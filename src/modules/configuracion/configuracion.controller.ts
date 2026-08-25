import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ConfiguracionService } from './configuracion.service';
import { SetConfiguracionDto } from './dto/set-configuracion.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolNombre } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Auditar } from '../../common/audit/auditar.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('configuracion')
export class ConfiguracionController {
  constructor(private readonly configuracionService: ConfiguracionService) {}

  @Get()
  @Roles(RolNombre.PROPIETARIO)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.configuracionService.findAll(user.empresaId);
  }

  @Get(':clave')
  @Roles(RolNombre.PROPIETARIO)
  findByClave(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clave') clave: string,
  ) {
    return this.configuracionService.findByClave(clave, user.empresaId);
  }

  @Put()
  @Auditar({ accion: 'ACTUALIZAR_CONFIGURACION', entidad: 'configuracion' })
  @Roles(RolNombre.PROPIETARIO)
  set(
    @Body() dto: SetConfiguracionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.configuracionService.set(dto, user.id, user.empresaId);
  }
}
