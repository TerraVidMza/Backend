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
import { InsumosService } from './insumos.service';
import { CreateInsumoDto } from './dto/create-insumo.dto';
import { UpdateInsumoDto } from './dto/update-insumo.dto';
import { SetCostoInsumoDto } from './dto/set-costo-insumo.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolNombre } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Auditar } from '../../common/audit/auditar.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('insumos')
export class InsumosController {
  constructor(private readonly insumosService: InsumosService) {}

  // El Capataz necesita el catálogo para cargar labores (HU-13), pero no los
  // costos: el historial de precios queda restringido.
  @Get()
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO, RolNombre.CAPATAZ)
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('incluirInactivos') incluirInactivos?: string,
  ) {
    return this.insumosService.findAll(
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
    return this.insumosService.findById(id, user.empresaId);
  }

  @Get(':id/costos')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  historialCostos(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.insumosService.getHistorialCostos(id, user.empresaId);
  }

  @Post()
  @Auditar({ accion: 'CREAR_INSUMO', entidad: 'insumo' })
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  create(@Body() dto: CreateInsumoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.insumosService.create(dto, user.id, user.empresaId);
  }

  @Patch(':id')
  @Auditar({
    accion: 'ACTUALIZAR_INSUMO',
    entidad: 'insumo',
    idDesde: 'param:id',
  })
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInsumoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.insumosService.update(id, dto, user.empresaId);
  }

  @Post(':id/costos')
  @Auditar({ accion: 'ACTUALIZAR_COSTO_INSUMO', entidad: 'costo_insumo' })
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  setCosto(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCostoInsumoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.insumosService.setCosto(id, dto, user.id, user.empresaId);
  }

  @Patch(':id/desactivar')
  @Auditar({
    accion: 'DESACTIVAR_INSUMO',
    entidad: 'insumo',
    idDesde: 'param:id',
  })
  @Roles(RolNombre.PROPIETARIO)
  desactivar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.insumosService.desactivar(id, user.empresaId);
  }
}
