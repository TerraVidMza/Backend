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

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tipos-labor')
export class TipoLaborController {
  constructor(private readonly tipoLaborService: TipoLaborService) {}

  @Get()
  findAll(@Query('incluirInactivos') incluirInactivos?: string) {
    return this.tipoLaborService.findAll(incluirInactivos !== 'true');
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tipoLaborService.findById(id);
  }

  @Get(':id/costos')
  historialCostos(@Param('id', ParseUUIDPipe) id: string) {
    return this.tipoLaborService.getHistorialCostos(id);
  }

  @Post()
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  create(
    @Body() dto: CreateTipoLaborDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tipoLaborService.create(dto, user.id);
  }

  @Patch(':id')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTipoLaborDto,
  ) {
    return this.tipoLaborService.update(id, dto);
  }

  @Post(':id/costos')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  setCosto(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCostoLaborDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tipoLaborService.setCosto(id, dto, user.id);
  }

  @Patch(':id/desactivar')
  @Roles(RolNombre.PROPIETARIO)
  desactivar(@Param('id', ParseUUIDPipe) id: string) {
    return this.tipoLaborService.desactivar(id);
  }
}
