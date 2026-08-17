import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CuadrillasService } from './cuadrillas.service';
import { CreateCuadrillaDto } from './dto/create-cuadrilla.dto';
import { UpdateCuadrillaDto } from './dto/update-cuadrilla.dto';
import { SetTarifaDto } from './dto/set-tarifa.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolNombre } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cuadrillas')
export class CuadrillasController {
  constructor(private readonly cuadrillasService: CuadrillasService) {}

  @Get()
  findByFinca(@Query('fincaId', ParseUUIDPipe) fincaId: string) {
    return this.cuadrillasService.findByFinca(fincaId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.cuadrillasService.findById(id);
  }

  @Get(':id/tarifas')
  historialTarifas(@Param('id', ParseUUIDPipe) id: string) {
    return this.cuadrillasService.getHistorialTarifas(id);
  }

  @Post()
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  create(@Body() dto: CreateCuadrillaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.cuadrillasService.create(dto, user.id);
  }

  @Patch(':id')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCuadrillaDto) {
    return this.cuadrillasService.update(id, dto);
  }

  @Post(':id/tarifas')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  setTarifa(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetTarifaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cuadrillasService.setTarifa(id, dto, user.id);
  }

  @Patch(':id/desactivar')
  @Roles(RolNombre.PROPIETARIO)
  desactivar(@Param('id', ParseUUIDPipe) id: string) {
    return this.cuadrillasService.desactivar(id);
  }
}
