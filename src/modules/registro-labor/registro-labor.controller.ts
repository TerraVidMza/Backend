import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RegistroLaborService } from './registro-labor.service';
import { CreateRegistroLaborDto } from './dto/create-registro-labor.dto';
import { SyncRegistroLaborDto } from './dto/sync-registro-labor.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolNombre } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('registro-labor')
export class RegistroLaborController {
  constructor(private readonly registroLaborService: RegistroLaborService) {}

  @Get('cuartel/:cuartelId')
  findByCuartel(@Param('cuartelId', ParseUUIDPipe) cuartelId: string) {
    return this.registroLaborService.findByCuartel(cuartelId);
  }

  @Get('cuartel/:cuartelId/margen-bruto')
  margenBruto(@Param('cuartelId', ParseUUIDPipe) cuartelId: string) {
    return this.registroLaborService.getMargenBrutoPorCuartel(cuartelId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.registroLaborService.findById(id);
  }

  @Post()
  @Roles(RolNombre.CAPATAZ, RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  registrarUno(
    @Body() dto: CreateRegistroLaborDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.registroLaborService.registrarUno(dto, user.id);
  }

  @Post('sync')
  @Roles(RolNombre.CAPATAZ, RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  sincronizarLote(
    @Body() dto: SyncRegistroLaborDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.registroLaborService.sincronizarLote(dto.registros, user.id);
  }
}
