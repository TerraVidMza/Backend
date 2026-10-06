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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EmpresasService } from './empresas.service';
import { CrearEmpresaDto } from './dto/crear-empresa.dto';
import { ActualizarEmpresaDto } from './dto/actualizar-empresa.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolNombre } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Auditar } from '../../common/audit/auditar.decorator';

/**
 * Administración de empresas cliente (D-025). Solo el Administrador de
 * plataforma: un Propietario administra **su** empresa, no las demás.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Empresas (plataforma)')
@ApiBearerAuth('jwt')
@Controller('empresas')
export class EmpresasController {
  constructor(private readonly empresasService: EmpresasService) {}

  @Get()
  @Roles(RolNombre.ADMINISTRADOR)
  listar() {
    return this.empresasService.listar();
  }

  @Post()
  @Roles(RolNombre.ADMINISTRADOR)
  @Auditar({ accion: 'CREAR_EMPRESA', entidad: 'empresa' })
  crear(@Body() dto: CrearEmpresaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.empresasService.crear(dto, user.id);
  }

  @Patch(':id')
  @Roles(RolNombre.ADMINISTRADOR)
  @Auditar({ accion: 'ACTUALIZAR_EMPRESA', entidad: 'empresa' })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarEmpresaDto,
  ) {
    return this.empresasService.actualizar(id, dto);
  }

  @Patch(':id/desactivar')
  @Roles(RolNombre.ADMINISTRADOR)
  @Auditar({ accion: 'DESACTIVAR_EMPRESA', entidad: 'empresa' })
  desactivar(@Param('id', ParseUUIDPipe) id: string) {
    return this.empresasService.setActiva(id, false);
  }

  @Patch(':id/activar')
  @Roles(RolNombre.ADMINISTRADOR)
  @Auditar({ accion: 'ACTIVAR_EMPRESA', entidad: 'empresa' })
  activar(@Param('id', ParseUUIDPipe) id: string) {
    return this.empresasService.setActiva(id, true);
  }
}
