import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TipoLaborService } from './tipo-labor.service';
import { CreateTipoLaborDto } from './dto/create-tipo-labor.dto';
import { UpdateTipoLaborDto } from './dto/update-tipo-labor.dto';
import { SetCostoLaborDto } from './dto/set-costo-labor.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolNombre } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Auditar } from '../../common/audit/auditar.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tipos-labor')
export class TipoLaborController {
  constructor(private readonly tipoLaborService: TipoLaborService) {}

  // El Capataz necesita el catálogo para cargar labores (HU-12), pero no los
  // costos: el historial de precios queda restringido.
  @Get()
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO, RolNombre.CAPATAZ)
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('incluirInactivos') incluirInactivos?: string,
  ) {
    return this.tipoLaborService.findAll(
      user.empresaId,
      incluirInactivos !== 'true',
    );
  }

  @Get(':id')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO, RolNombre.CAPATAZ)
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tipoLaborService.findById(id, user.empresaId);
  }

  @Get(':id/costos')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  historialCostos(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tipoLaborService.getHistorialCostos(id, user.empresaId);
  }

  @Post()
  @Auditar({ accion: 'CREAR_TIPO_LABOR', entidad: 'tipo_labor' })
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  create(
    @Body() dto: CreateTipoLaborDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tipoLaborService.create(dto, user.id, user.empresaId);
  }

  @Patch(':id')
  @Auditar({
    accion: 'ACTUALIZAR_TIPO_LABOR',
    entidad: 'tipo_labor',
    idDesde: 'param:id',
  })
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTipoLaborDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tipoLaborService.update(id, dto, user.empresaId);
  }

  @Post(':id/costos')
  @Auditar({ accion: 'ACTUALIZAR_COSTO_LABOR', entidad: 'costo_labor' })
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  setCosto(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCostoLaborDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tipoLaborService.setCosto(id, dto, user.id, user.empresaId);
  }

  @Patch(':id/desactivar')
  @Auditar({
    accion: 'DESACTIVAR_TIPO_LABOR',
    entidad: 'tipo_labor',
    idDesde: 'param:id',
  })
  @Roles(RolNombre.PROPIETARIO)
  desactivar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tipoLaborService.desactivar(id, user.empresaId);
  }
}
