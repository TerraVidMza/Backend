import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SensoresService } from './sensores.service';
import { CreateSensorDto } from './dto/create-sensor.dto';
import { UpdateSensorDto } from './dto/update-sensor.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolNombre } from '../../common/enums/rol.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sensores')
export class SensoresController {
  constructor(private readonly sensoresService: SensoresService) {}

  @Get()
  findByFinca(@Query('fincaId', ParseUUIDPipe) fincaId: string) {
    return this.sensoresService.findByFinca(fincaId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sensoresService.findById(id);
  }

  @Post()
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  create(@Body() dto: CreateSensorDto) {
    return this.sensoresService.create(dto);
  }

  @Patch(':id')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSensorDto) {
    return this.sensoresService.update(id, dto);
  }

  @Patch(':id/desactivar')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  desactivar(@Param('id', ParseUUIDPipe) id: string) {
    return this.sensoresService.desactivar(id);
  }
}
