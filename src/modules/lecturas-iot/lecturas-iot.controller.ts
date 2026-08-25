import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LecturasIotService } from './lecturas-iot.service';
import { IngestLecturaDto } from './dto/ingest-lectura.dto';
import { ListarLecturasDto, SerieLecturasDto } from './dto/listar-lecturas.dto';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RolNombre } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AlcanceEmpresaService } from '../../common/tenant/alcance-empresa.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@UseGuards(JwtAuthGuard)
@Controller('lecturas-iot')
export class LecturasIotController {
  constructor(
    private readonly lecturasIotService: LecturasIotService,
    private readonly alcance: AlcanceEmpresaService,
    private readonly configuracionService: ConfiguracionService,
  ) {}

  @Get('sensor/:sensorId')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  async findBySensor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sensorId', ParseUUIDPipe) sensorId: string,
    @Query() query: ListarLecturasDto,
  ) {
    await this.alcance.verificarSensor(sensorId, user.empresaId);
    return this.lecturasIotService.findBySensor(sensorId, query);
  }

  /**
   * Serie agregada por hora o por día para los gráficos de HU-20. El historial
   * crudo es inmanejable para graficar: un mes de un sensor que mide cada 5
   * minutos son ~9.000 puntos.
   */
  @Get('sensor/:sensorId/serie')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  async serie(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sensorId', ParseUUIDPipe) sensorId: string,
    @Query() query: SerieLecturasDto,
  ) {
    await this.alcance.verificarSensor(sensorId, user.empresaId);
    const zonaHoraria = await this.configuracionService.getZonaHoraria(
      user.empresaId,
    );
    return this.lecturasIotService.serie(sensorId, query, zonaHoraria);
  }

  /**
   * Ingesta de telemetría desde los nodos ESP32.
   *
   * `@Public()` la exime del JWT de usuario (que un dispositivo no puede
   * sostener), pero NO la deja abierta: `ApiKeyGuard` exige la clave del canal
   * de dispositivos. Antes este handler quedaba bajo el JWT global sin `@Roles`,
   * de modo que cualquier usuario autenticado de cualquier empresa podía
   * inyectar lecturas falsas y disparar alertas.
   */
  @Public()
  @UseGuards(ApiKeyGuard)
  @Post()
  ingest(@Body() dto: IngestLecturaDto) {
    return this.lecturasIotService.ingest(dto);
  }
}
