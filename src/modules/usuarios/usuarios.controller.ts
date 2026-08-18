import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { RolNombre } from '../../common/enums/rol.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @Roles(RolNombre.PROPIETARIO)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.usuariosService.findAll(user.empresaId);
  }

  @Get('me')
  findMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usuariosService.findById(user.id);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUsuarioDto,
  ) {
    return this.usuariosService.update(user.id, dto);
  }

  @Get(':id')
  @Roles(RolNombre.PROPIETARIO)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usuariosService.findById(id);
  }

  @Post()
  @Roles(RolNombre.PROPIETARIO)
  create(@Body() dto: CreateUsuarioDto) {
    return this.usuariosService.create(dto);
  }

  @Patch(':id')
  @Roles(RolNombre.PROPIETARIO)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUsuarioDto,
  ) {
    return this.usuariosService.update(id, dto);
  }

  @Patch(':id/desactivar')
  @Roles(RolNombre.PROPIETARIO)
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.usuariosService.deactivate(id);
  }
}
