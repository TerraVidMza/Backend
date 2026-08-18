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
import { FincasService } from './fincas.service';
import { CreateFincaDto } from './dto/create-finca.dto';
import { UpdateFincaDto } from './dto/update-finca.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolNombre } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fincas')
export class FincasController {
  constructor(private readonly fincasService: FincasService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('search') search?: string,
  ) {
    return this.fincasService.findAll(user.empresaId, search);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.fincasService.findById(id);
  }

  @Post()
  @Roles(RolNombre.PROPIETARIO)
  create(@Body() dto: CreateFincaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.fincasService.create(dto, user.id);
  }

  @Patch(':id')
  @Roles(RolNombre.PROPIETARIO)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFincaDto) {
    return this.fincasService.update(id, dto);
  }

  @Patch(':id/desactivar')
  @Roles(RolNombre.PROPIETARIO)
  desactivar(@Param('id', ParseUUIDPipe) id: string) {
    return this.fincasService.desactivar(id);
  }
}
