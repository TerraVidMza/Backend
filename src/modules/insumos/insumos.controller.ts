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

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('insumos')
export class InsumosController {
  constructor(private readonly insumosService: InsumosService) {}

  @Get()
  findAll(@Query('incluirInactivos') incluirInactivos?: string) {
    return this.insumosService.findAll(incluirInactivos !== 'true');
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.insumosService.findById(id);
  }

  @Get(':id/costos')
  historialCostos(@Param('id', ParseUUIDPipe) id: string) {
    return this.insumosService.getHistorialCostos(id);
  }

  @Post()
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  create(@Body() dto: CreateInsumoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.insumosService.create(dto, user.id);
  }

  @Patch(':id')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateInsumoDto) {
    return this.insumosService.update(id, dto);
  }

  @Post(':id/costos')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  setCosto(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCostoInsumoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.insumosService.setCosto(id, dto, user.id);
  }

  @Patch(':id/desactivar')
  @Roles(RolNombre.PROPIETARIO)
  desactivar(@Param('id', ParseUUIDPipe) id: string) {
    return this.insumosService.desactivar(id);
  }
}
