import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  HttpStatus,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { RegistroLaborService } from './registro-labor.service';
import { CreateRegistroLaborDto } from './dto/create-registro-labor.dto';
import { SyncRegistroLaborDto } from './dto/sync-registro-labor.dto';
import { ListarLaboresDto } from './dto/listar-labores.dto';
import { CosteoQueryDto } from './dto/costeo-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolNombre } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AlcanceEmpresaService } from '../../common/tenant/alcance-empresa.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Auditar } from '../../common/audit/auditar.decorator';
import { hoyLocal } from '../../common/fechas/rango-fechas';

/**
 * Roles que llegan al historial pero no al dinero.
 *
 * `costeo` y `margen-bruto` ya excluyen al Auditor por `@Roles`, con el
 * comentario "dato económico". El historial por cuartel no podía hacer lo
 * mismo —HU-17 se lo concede— y devolvía el costo unitario de la labor y el de
 * cada insumo, así que el mismo dato salía por otra puerta. Se filtra en el
 * payload en lugar de cerrar el endpoint.
 */
function sinAlcanceEconomico(user: AuthenticatedUser): boolean {
  return user.rol === RolNombre.AUDITOR;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('registro-labor')
export class RegistroLaborController {
  constructor(
    private readonly registroLaborService: RegistroLaborService,
    private readonly alcance: AlcanceEmpresaService,
  ) {}

  // El historial por cuartel es el único recurso de negocio que HU-17 le
  // concede al Auditor, además del log de auditoría. Lo ve completo salvo los
  // costos: ver `sinAlcanceEconomico`.
  @Get('cuartel/:cuartelId')
  @Roles(
    RolNombre.PROPIETARIO,
    RolNombre.AGRONOMO,
    RolNombre.CAPATAZ,
    RolNombre.AUDITOR,
  )
  async findByCuartel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cuartelId', ParseUUIDPipe) cuartelId: string,
    @Query() query: ListarLaboresDto,
  ) {
    await this.alcance.verificarCuartel(cuartelId, user.empresaId);

    // HU-17: el Capataz solo ve sus propios registros del día. El resto del
    // historial del cuartel expone trabajo y costos de terceros.
    const restringirA =
      user.rol === RolNombre.CAPATAZ
        ? { usuarioId: user.id, fecha: hoyLocal() }
        : undefined;

    return this.registroLaborService.findByCuartel(
      cuartelId,
      query,
      restringirA,
      sinAlcanceEconomico(user),
    );
  }

  /**
   * Tabla de costeo de HU-15: todos los cuarteles de la empresa con su costo
   * total y por hectárea. Dato económico, así que queda fuera del alcance del
   * Capataz y del Auditor.
   */
  @Get('costeo')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  async costeo(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CosteoQueryDto,
  ) {
    if (query.fincaId) {
      await this.alcance.verificarFinca(query.fincaId, user.empresaId);
    }
    return this.registroLaborService.getCosteoPorCuartel(user.empresaId, query);
  }

  // Dato económico: no lo ven ni el Capataz ni el Auditor.
  @Get('cuartel/:cuartelId/margen-bruto')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  async margenBruto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cuartelId', ParseUUIDPipe) cuartelId: string,
  ) {
    await this.alcance.verificarCuartel(cuartelId, user.empresaId);
    return this.registroLaborService.getMargenBrutoPorCuartel(cuartelId);
  }

  @Get(':id')
  @Roles(
    RolNombre.PROPIETARIO,
    RolNombre.AGRONOMO,
    RolNombre.CAPATAZ,
    RolNombre.AUDITOR,
  )
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.registroLaborService.findById(
      id,
      user.empresaId,
      sinAlcanceEconomico(user),
    );
  }

  @Post()
  @Auditar({ accion: 'REGISTRAR_LABOR', entidad: 'registro_labor' })
  @Roles(RolNombre.CAPATAZ, RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  async registrarUno(
    @Body() dto: CreateRegistroLaborDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.alcance.verificarCuartel(dto.cuartelId, user.empresaId);
    // Los catálogos son por empresa (D-h): sin esta verificación un registro
    // podría referenciar el tipo de labor de otra empresa y aplicar sus costos.
    await this.alcance.verificarTipoLabor(dto.tipoLaborId, user.empresaId);
    await this.alcance.verificarInsumos(
      dto.insumos.map((i) => i.insumoId),
      user.empresaId,
    );
    const resultado = await this.registroLaborService.registrarUno(
      dto,
      user.id,
    );
    // HU-14: 201 cuando se crea, 200 cuando el mismo `local_uuid` ya estaba
    // sincronizado. El cliente distingue así "se guardó ahora" de "ya estaba",
    // que es lo que necesita para no volver a contarlo como pendiente.
    res.status(resultado.yaExistia ? HttpStatus.OK : HttpStatus.CREATED);
    return resultado;
  }

  @Post('sync')
  @Auditar({
    accion: 'SINCRONIZAR_LABORES',
    entidad: 'registro_labor',
    datos: 'ninguno',
  })
  @Roles(RolNombre.CAPATAZ, RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  async sincronizarLote(
    @Body() dto: SyncRegistroLaborDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Un lote puede tocar varios cuarteles: se verifican todos antes de
    // procesar, así un registro dirigido a otra empresa no entra en el batch.
    const cuartelIds = [...new Set(dto.registros.map((r) => r.cuartelId))];
    for (const cuartelId of cuartelIds) {
      await this.alcance.verificarCuartel(cuartelId, user.empresaId);
    }

    // Mismo criterio para los catálogos por empresa (D-h).
    const tipoLaborIds = [...new Set(dto.registros.map((r) => r.tipoLaborId))];
    for (const tipoLaborId of tipoLaborIds) {
      await this.alcance.verificarTipoLabor(tipoLaborId, user.empresaId);
    }
    await this.alcance.verificarInsumos(
      dto.registros.flatMap((r) => r.insumos.map((i) => i.insumoId)),
      user.empresaId,
    );
    return this.registroLaborService.sincronizarLote(dto.registros, user.id);
  }
}
