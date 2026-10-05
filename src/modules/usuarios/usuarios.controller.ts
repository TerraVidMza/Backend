import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UpdatePerfilDto } from './dto/update-perfil.dto';
import { ListarUsuariosDto } from './dto/listar-usuarios.dto';
import { AsignarFincasDto } from './dto/asignar-fincas.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AnyRole } from '../../common/decorators/any-role.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { RolNombre } from '../../common/enums/rol.enum';
import { Auditar } from '../../common/audit/auditar.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { permisosDe } from '../../common/permisos/permisos';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Usuarios y roles')
@ApiBearerAuth('jwt')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @Roles(RolNombre.PROPIETARIO)
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListarUsuariosDto,
  ) {
    return this.usuariosService.findAll(user.empresaId, query);
  }

  // El perfil propio no depende del rol: cada usuario ve y edita el suyo.
  @AnyRole()
  @Get('me')
  async findMe(@CurrentUser() user: AuthenticatedUser) {
    const usuario = await this.usuariosService.findById(user.id);
    // Los permisos del rol actual (D-024): el cliente los refresca sin
    // esperar a la próxima renovación de sesión.
    return usuario ? { ...usuario, permisos: permisosDe(user.rol) } : usuario;
  }

  @AnyRole()
  @Patch('me')
  @Auditar({ accion: 'ACTUALIZAR_PERFIL', entidad: 'usuario' })
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePerfilDto,
  ) {
    return this.usuariosService.updatePerfil(user.id, dto);
  }

  @Get(':id')
  @Roles(RolNombre.PROPIETARIO)
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usuariosService.findById(id, user.empresaId);
  }

  @Post()
  @Auditar({ accion: 'CREAR_USUARIO', entidad: 'usuario' })
  @Roles(RolNombre.PROPIETARIO)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUsuarioDto,
  ) {
    return this.usuariosService.create(dto, user.empresaId);
  }

  @Patch(':id')
  @Auditar({
    accion: 'ACTUALIZAR_USUARIO',
    entidad: 'usuario',
    idDesde: 'param:id',
  })
  @Roles(RolNombre.PROPIETARIO)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUsuarioDto,
  ) {
    return this.usuariosService.update(id, dto, user);
  }

  /**
   * Fincas a las que se asigna el usuario, **solo para enrutar avisos** (HU-22).
   * Sin asignaciones recibe los de todas las fincas de su empresa.
   */
  @Get(':id/fincas')
  @Roles(RolNombre.PROPIETARIO)
  fincasAsignadas(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usuariosService.getFincasAsignadas(id, user.empresaId);
  }

  @Put(':id/fincas')
  @Auditar({
    accion: 'ASIGNAR_FINCAS',
    entidad: 'usuario_finca',
    idDesde: 'param:id',
  })
  @Roles(RolNombre.PROPIETARIO)
  asignarFincas(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarFincasDto,
  ) {
    return this.usuariosService.asignarFincas(id, dto.fincaIds, user.empresaId);
  }

  @Patch(':id/desactivar')
  @Auditar({
    accion: 'DESACTIVAR_USUARIO',
    entidad: 'usuario',
    idDesde: 'param:id',
  })
  @Roles(RolNombre.PROPIETARIO)
  deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usuariosService.deactivate(id, user.empresaId);
  }
}
