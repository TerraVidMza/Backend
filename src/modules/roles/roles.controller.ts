import { Controller, Get, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolNombre } from '../../common/enums/rol.enum';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Usuarios y roles')
@ApiBearerAuth('jwt')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  // Solo el Propietario asigna roles (HU-06), así que solo él necesita el
  // catálogo. Cuando este endpoint era abierto, cualquier usuario obtenía el
  // UUID del rol Propietario, que era el insumo de la escalada de privilegios.
  @Get()
  @Roles(RolNombre.PROPIETARIO)
  findAll() {
    return this.rolesService.findAll();
  }
}
