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
import { CuadrillasService } from './cuadrillas.service';
import { CreateCuadrillaDto } from './dto/create-cuadrilla.dto';
import { UpdateCuadrillaDto } from './dto/update-cuadrilla.dto';
import { SetTarifaDto } from './dto/set-tarifa.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolNombre } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AlcanceEmpresaService } from '../../common/tenant/alcance-empresa.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Auditar } from '../../common/audit/auditar.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Vendimia')
@ApiBearerAuth('jwt')
@Controller('cuadrillas')
export class CuadrillasController {
  constructor(
    private readonly cuadrillasService: CuadrillasService,
    private readonly alcance: AlcanceEmpresaService,
  ) {}

  // El Capataz necesita el listado para registrar pesajes (HU-24), pero HU-23
  // le oculta la tarifa a destajo: el historial de tarifas queda restringido.
  @Get()
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO, RolNombre.CAPATAZ)
  async findByFinca(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fincaId', ParseUUIDPipe) fincaId: string,
  ) {
    await this.alcance.verificarFinca(fincaId, user.empresaId);
    return this.cuadrillasService.findByFinca(fincaId);
  }

  @Get(':id')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO, RolNombre.CAPATAZ)
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.alcance.verificarCuadrilla(id, user.empresaId);
    return this.cuadrillasService.findById(id);
  }

  @Get(':id/tarifas')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  async historialTarifas(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.alcance.verificarCuadrilla(id, user.empresaId);
    return this.cuadrillasService.getHistorialTarifas(id);
  }

  // HU-23 habilita al Capataz a crear cuadrillas; el service descarta la
  // tarifa si el solicitante no es Propietario.
  @Post()
  @Auditar({ accion: 'CREAR_CUADRILLA', entidad: 'cuadrilla' })
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO, RolNombre.CAPATAZ)
  async create(
    @Body() dto: CreateCuadrillaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.alcance.verificarFinca(dto.fincaId, user.empresaId);
    return this.cuadrillasService.create(dto, user.id, user.rol);
  }

  @Patch(':id')
  @Auditar({
    accion: 'ACTUALIZAR_CUADRILLA',
    entidad: 'cuadrilla',
    idDesde: 'param:id',
  })
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCuadrillaDto,
  ) {
    await this.alcance.verificarCuadrilla(id, user.empresaId);
    return this.cuadrillasService.update(id, dto);
  }

  // La tarifa a destajo la fija solo el Propietario (HU-23).
  @Post(':id/tarifas')
  @Auditar({ accion: 'ASIGNAR_TARIFA', entidad: 'tarifa_cuadrilla' })
  @Roles(RolNombre.PROPIETARIO)
  async setTarifa(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetTarifaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.alcance.verificarCuadrilla(id, user.empresaId);
    return this.cuadrillasService.setTarifa(id, dto, user.id);
  }

  @Patch(':id/desactivar')
  @Auditar({
    accion: 'DESACTIVAR_CUADRILLA',
    entidad: 'cuadrilla',
    idDesde: 'param:id',
  })
  @Roles(RolNombre.PROPIETARIO)
  async desactivar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.alcance.verificarCuadrilla(id, user.empresaId);
    return this.cuadrillasService.desactivar(id);
  }
}
