import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ConfiguracionService } from './configuracion.service';
import { SetConfiguracionDto } from './dto/set-configuracion.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AnyRole } from '../../common/decorators/any-role.decorator';
import { RolNombre } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Auditar } from '../../common/audit/auditar.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Dashboard y configuración')
@ApiBearerAuth('jwt')
@Controller('configuracion')
export class ConfiguracionController {
  constructor(private readonly configuracionService: ConfiguracionService) {}

  @Get()
  @Roles(RolNombre.PROPIETARIO)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.configuracionService.findAll(user.empresaId);
  }

  /**
   * Preferencias de presentación de la empresa (D-020).
   *
   * Va antes de `:clave`: la ruta con parámetro capturaría "preferencias".
   *
   * Es `@AnyRole()` mientras `GET /configuracion` sigue siendo del Propietario
   * porque devuelve otra cosa: solo `CLAVES_PREFERENCIAS`, sin ninguna clave de
   * SMTP. Toda la interfaz necesita la moneda, las unidades y la zona horaria
   * para formatear lo que muestra, y esos tres valores no son un secreto.
   */
  @Get('preferencias')
  @AnyRole()
  findPreferencias(@CurrentUser() user: AuthenticatedUser) {
    return this.configuracionService.findPreferencias(user.empresaId);
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
