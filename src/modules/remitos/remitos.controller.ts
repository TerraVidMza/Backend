import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { RemitosService } from './remitos.service';
import { GenerarRemitoDto } from './dto/generar-remito.dto';
import { RechazarRemitoDto } from './dto/rechazar-remito.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolNombre } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('remitos')
export class RemitosController {
  constructor(private readonly remitosService: RemitosService) {}

  @Get()
  findByCuartel(@Query('cuartelId', ParseUUIDPipe) cuartelId: string) {
    return this.remitosService.findByCuartel(cuartelId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.remitosService.findById(id);
  }

  @Post('generar-borrador')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO, RolNombre.CAPATAZ)
  generarBorrador(@Body() dto: GenerarRemitoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.remitosService.generarBorrador(dto.cuartelId, user.id);
  }

  @Post(':id/aprobar')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  aprobar(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.remitosService.aprobar(id, user.id);
  }

  @Post(':id/rechazar')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  rechazar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RechazarRemitoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.remitosService.rechazar(id, user.id, dto.motivoRechazo);
  }
}
