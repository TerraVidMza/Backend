import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InteligenciaAgronomicaService } from './inteligencia-agronomica.service';
import { CompararCampaniasDto } from './dto/comparar-campanias.dto';
import { CorrelacionDto } from './dto/correlacion.dto';
import { ResolverRecomendacionDto } from './dto/resolver-recomendacion.dto';
import { EstadoRecomendacion } from './entities/recomendacion.entity';
import { Auditar } from '../../common/audit/auditar.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolNombre } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AlcanceEmpresaService } from '../../common/tenant/alcance-empresa.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

// Todos los endpoints cruzan costos con telemetría, así que quedan restringidos
// a los roles que HU-29/30/31 declaran como actores.
@Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
@UseGuards(JwtAuthGuard)
@Controller('inteligencia-agronomica')
export class InteligenciaAgronomicaController {
  constructor(
    private readonly inteligenciaAgronomicaService: InteligenciaAgronomicaService,
    private readonly alcance: AlcanceEmpresaService,
  ) {}

  @Get('correlacion/:cuartelId')
  async correlacion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cuartelId', ParseUUIDPipe) cuartelId: string,
    @Query() query: CorrelacionDto,
  ) {
    // Se verifican los dos: si no, se podría cruzar el sensor de una empresa
    // con los costos de un cuartel de otra.
    await this.alcance.verificarCuartel(cuartelId, user.empresaId);
    await this.alcance.verificarSensor(query.sensorId, user.empresaId);
    return this.inteligenciaAgronomicaService.correlacionSensorCostos(
      cuartelId,
      query.sensorId,
      query.desde,
      query.hasta,
      user.empresaId,
    );
  }

  /**
   * Consultar evalúa las reglas y persiste lo que corresponda, así que este GET
   * tiene efecto de escritura. Es deliberado: la HU pide que las
   * recomendaciones se generen del histórico y queden accionables, y no hay
   * ningún momento natural para dispararlas salvo abrir la pantalla. Reevaluar
   * es idempotente — el índice parcial impide duplicar la recomendación activa.
   */
  @Get('recomendaciones/:cuartelId')
  async recomendaciones(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cuartelId', ParseUUIDPipe) cuartelId: string,
  ) {
    await this.alcance.verificarCuartel(cuartelId, user.empresaId);
    return this.inteligenciaAgronomicaService.getRecomendaciones(
      cuartelId,
      user.empresaId,
    );
  }

  @Patch('recomendaciones/:id')
  @Auditar({
    accion: 'RESOLVER_RECOMENDACION',
    entidad: 'recomendacion',
    idDesde: 'param:id',
  })
  async resolverRecomendacion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolverRecomendacionDto,
  ) {
    return this.inteligenciaAgronomicaService.resolverRecomendacion(
      id,
      user.empresaId,
      dto.estado as unknown as
        EstadoRecomendacion.APLICADA | EstadoRecomendacion.DESCARTADA,
      dto.nota,
      user.id,
    );
  }

  /**
   * Los períodos se piden por **id de campaña** (`campaniaA`/`campaniaB`).
   * Las cuatro fechas sueltas siguen aceptándose para comparaciones ad-hoc que
   * no coinciden con ninguna campaña cargada.
   */
  @Get('comparar-campanias/:cuartelId')
  async compararCampanias(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cuartelId', ParseUUIDPipe) cuartelId: string,
    @Query() query: CompararCampaniasDto,
  ) {
    await this.alcance.verificarCuartel(cuartelId, user.empresaId);
    return this.inteligenciaAgronomicaService.compararCampanias(
      cuartelId,
      user.empresaId,
      {
        a: {
          campaniaId: query.campaniaA,
          desde: query.desde1,
          hasta: query.hasta1,
        },
        b: {
          campaniaId: query.campaniaB,
          desde: query.desde2,
          hasta: query.hasta2,
        },
      },
    );
  }
}
