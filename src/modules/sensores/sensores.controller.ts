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
import { SensoresService } from './sensores.service';
import { CreateSensorDto } from './dto/create-sensor.dto';
import { UpdateSensorDto } from './dto/update-sensor.dto';
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
@ApiTags('Telemetría IoT')
@ApiBearerAuth('jwt')
@Controller('sensores')
export class SensoresController {
  constructor(
    private readonly sensoresService: SensoresService,
    private readonly alcance: AlcanceEmpresaService,
  ) {}

  @Get()
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  async findByFinca(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fincaId', ParseUUIDPipe) fincaId: string,
  ) {
    await this.alcance.verificarFinca(fincaId, user.empresaId);
    return this.sensoresService.findByFinca(fincaId);
  }

  @Get(':id')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.alcance.verificarSensor(id, user.empresaId);
    return this.sensoresService.findById(id);
  }

  @Post()
  @Auditar({ accion: 'CREAR_SENSOR', entidad: 'sensor' })
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSensorDto,
  ) {
    await this.alcance.verificarFinca(dto.fincaId, user.empresaId);
    return this.sensoresService.create(dto);
  }

  @Patch(':id')
  @Auditar({
    accion: 'ACTUALIZAR_SENSOR',
    entidad: 'sensor',
    idDesde: 'param:id',
  })
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSensorDto,
  ) {
    await this.alcance.verificarSensor(id, user.empresaId);
    return this.sensoresService.update(id, dto);
  }

  @Patch(':id/desactivar')
  @Auditar({
    accion: 'DESACTIVAR_SENSOR',
    entidad: 'sensor',
    idDesde: 'param:id',
  })
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  async desactivar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.alcance.verificarSensor(id, user.empresaId);
    return this.sensoresService.desactivar(id);
  }
}
