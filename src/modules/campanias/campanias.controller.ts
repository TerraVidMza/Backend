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
import { CampaniasService } from './campanias.service';
import { CreateCampaniaDto } from './dto/create-campania.dto';
import { UpdateCampaniaDto } from './dto/update-campania.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AnyRole } from '../../common/decorators/any-role.decorator';
import { RolNombre } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Auditar } from '../../common/audit/auditar.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('campanias')
export class CampaniasController {
  constructor(private readonly campaniasService: CampaniasService) {}

  // Cualquier rol lee las campañas: son el eje temporal de casi toda pantalla
  // (selector de comparación, filtros de historial, encabezado del dashboard) y
  // no contienen ningún dato económico.
  @Get()
  @AnyRole()
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.campaniasService.findAll(user.empresaId);
  }

  /** La campaña abierta que contiene el día de hoy, o `null` si no hay ninguna. */
  @Get('actual')
  @AnyRole()
  async getActual(@CurrentUser() user: AuthenticatedUser) {
    return this.campaniasService.getActual(user.empresaId);
  }

  @Get(':id')
  @AnyRole()
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.campaniasService.findById(id, user.empresaId);
  }

  @Post()
  @Auditar({ accion: 'CREAR_CAMPANIA', entidad: 'campania' })
  @Roles(RolNombre.PROPIETARIO)
  async create(
    @Body() dto: CreateCampaniaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.campaniasService.create(dto, user.empresaId);
  }

  @Patch(':id')
  @Auditar({
    accion: 'ACTUALIZAR_CAMPANIA',
    entidad: 'campania',
    idDesde: 'param:id',
  })
  @Roles(RolNombre.PROPIETARIO)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaniaDto,
  ) {
    return this.campaniasService.update(id, user.empresaId, dto);
  }

  @Patch(':id/cerrar')
  @Auditar({
    accion: 'CERRAR_CAMPANIA',
    entidad: 'campania',
    idDesde: 'param:id',
  })
  @Roles(RolNombre.PROPIETARIO)
  async cerrar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.campaniasService.setCerrada(id, user.empresaId, true);
  }

  @Patch(':id/reabrir')
  @Auditar({
    accion: 'REABRIR_CAMPANIA',
    entidad: 'campania',
    idDesde: 'param:id',
  })
  @Roles(RolNombre.PROPIETARIO)
  async reabrir(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.campaniasService.setCerrada(id, user.empresaId, false);
  }
}
