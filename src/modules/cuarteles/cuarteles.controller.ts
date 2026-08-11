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
import { CuartelesService } from './cuarteles.service';
import { CreateCuartelDto } from './dto/create-cuartel.dto';
import { UpdateCuartelDto } from './dto/update-cuartel.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolNombre } from '../../common/enums/rol.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cuarteles')
export class CuartelesController {
  constructor(private readonly cuartelesService: CuartelesService) {}

  @Get()
  findByFinca(@Query('fincaId', ParseUUIDPipe) fincaId: string) {
    return this.cuartelesService.findByFinca(fincaId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.cuartelesService.findById(id);
  }

  @Post()
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  create(@Body() dto: CreateCuartelDto) {
    return this.cuartelesService.create(dto);
  }

  @Patch(':id')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCuartelDto,
  ) {
    return this.cuartelesService.update(id, dto);
  }

  @Patch(':id/desactivar')
  @Roles(RolNombre.PROPIETARIO)
  desactivar(@Param('id', ParseUUIDPipe) id: string) {
    return this.cuartelesService.desactivar(id);
  }
}
