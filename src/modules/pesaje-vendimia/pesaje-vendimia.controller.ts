import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { PesajeVendimiaService } from './pesaje-vendimia.service';
import { CreatePesajeDto } from './dto/create-pesaje.dto';
import { SyncPesajeDto } from './dto/sync-pesaje.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolNombre } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pesajes-vendimia')
export class PesajeVendimiaController {
  constructor(private readonly pesajeVendimiaService: PesajeVendimiaService) {}

  @Get('cuartel/:cuartelId')
  findByCuartel(@Param('cuartelId', ParseUUIDPipe) cuartelId: string) {
    return this.pesajeVendimiaService.findByCuartel(cuartelId);
  }

  @Get('cuartel/:cuartelId/estado-cosecha')
  estadoCosecha(@Param('cuartelId', ParseUUIDPipe) cuartelId: string) {
    return this.pesajeVendimiaService.getEstadoCosechaPorCuartel(cuartelId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.pesajeVendimiaService.findById(id);
  }

  @Post()
  @Roles(RolNombre.CAPATAZ, RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  registrarUno(@Body() dto: CreatePesajeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.pesajeVendimiaService.registrarUno(dto, user.id);
  }

  @Post('sync')
  @Roles(RolNombre.CAPATAZ, RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  sincronizarLote(@Body() dto: SyncPesajeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.pesajeVendimiaService.sincronizarLote(dto.pesajes, user.id);
  }
}
