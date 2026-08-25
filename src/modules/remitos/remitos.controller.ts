import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RemitosService } from './remitos.service';
import { GenerarRemitoDto } from './dto/generar-remito.dto';
import { RechazarRemitoDto } from './dto/rechazar-remito.dto';
import { ListarRemitosDto } from './dto/listar-remitos.dto';
import { RegistrarLiquidacionDto } from './dto/registrar-liquidacion.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolNombre } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AlcanceEmpresaService } from '../../common/tenant/alcance-empresa.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Auditar } from '../../common/audit/auditar.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('remitos')
export class RemitosController {
  constructor(
    private readonly remitosService: RemitosService,
    private readonly alcance: AlcanceEmpresaService,
  ) {}

  @Get()
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO, RolNombre.CAPATAZ)
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListarRemitosDto,
  ) {
    return this.remitosService.findAll(user.empresaId, query);
  }

  @Get(':id')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO, RolNombre.CAPATAZ)
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.remitosService.findByIdConDetalle(id, user.empresaId);
  }

  /**
   * Registra lo que la bodega pagó por el remito (D-005). Dato económico: lo
   * cargan Propietario y Agrónomo, no el Capataz.
   */
  @Put(':id/liquidacion')
  @Auditar({
    accion: 'REGISTRAR_LIQUIDACION',
    entidad: 'liquidacion_bodega',
    idDesde: 'param:id',
  })
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  registrarLiquidacion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegistrarLiquidacionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.remitosService.registrarLiquidacion(
      id,
      dto,
      user.id,
      user.empresaId,
    );
  }

  @Get(':id/liquidacion')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  getLiquidacion(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.remitosService.getLiquidacion(id, user.empresaId);
  }

  @Post('generar-borrador')
  @Auditar({ accion: 'GENERAR_REMITO', entidad: 'remito' })
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO, RolNombre.CAPATAZ)
  async generarBorrador(
    @Body() dto: GenerarRemitoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.alcance.verificarCuartel(dto.cuartelId, user.empresaId);
    return this.remitosService.generarBorrador(
      dto.cuartelId,
      user.id,
      dto.fecha,
    );
  }

  @Post(':id/aprobar')
  @Auditar({ accion: 'APROBAR_REMITO', entidad: 'remito', idDesde: 'param:id' })
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  aprobar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.remitosService.aprobar(id, user.id, user.empresaId);
  }

  @Post(':id/rechazar')
  @Auditar({
    accion: 'RECHAZAR_REMITO',
    entidad: 'remito',
    idDesde: 'param:id',
  })
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  rechazar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RechazarRemitoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.remitosService.rechazar(
      id,
      user.id,
      dto.motivoRechazo,
      user.empresaId,
    );
  }
}
