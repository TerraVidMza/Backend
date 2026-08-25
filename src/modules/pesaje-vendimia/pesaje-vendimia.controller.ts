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
import { PesajeVendimiaService } from './pesaje-vendimia.service';
import { CreatePesajeDto } from './dto/create-pesaje.dto';
import { SyncPesajeDto } from './dto/sync-pesaje.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolNombre } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AlcanceEmpresaService } from '../../common/tenant/alcance-empresa.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Auditar } from '../../common/audit/auditar.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pesajes-vendimia')
export class PesajeVendimiaController {
  constructor(
    private readonly pesajeVendimiaService: PesajeVendimiaService,
    private readonly alcance: AlcanceEmpresaService,
  ) {}

  @Get('cuartel/:cuartelId')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO, RolNombre.CAPATAZ)
  async findByCuartel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cuartelId', ParseUUIDPipe) cuartelId: string,
    @Query() query: PaginationQueryDto,
  ) {
    await this.alcance.verificarCuartel(cuartelId, user.empresaId);
    return this.pesajeVendimiaService.findByCuartel(cuartelId, query);
  }

  /** Tabla de seguimiento de la vendimia por finca (HU-28). */
  @Get('finca/:fincaId/estado-cosecha')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO, RolNombre.CAPATAZ)
  async estadoCosechaFinca(
    @CurrentUser() user: AuthenticatedUser,
    @Param('fincaId', ParseUUIDPipe) fincaId: string,
  ) {
    await this.alcance.verificarFinca(fincaId, user.empresaId);
    return this.pesajeVendimiaService.getEstadoCosechaPorFinca(fincaId);
  }

  @Get('cuartel/:cuartelId/estado-cosecha')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO, RolNombre.CAPATAZ)
  async estadoCosecha(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cuartelId', ParseUUIDPipe) cuartelId: string,
  ) {
    await this.alcance.verificarCuartel(cuartelId, user.empresaId);
    return this.pesajeVendimiaService.getEstadoCosechaPorCuartel(cuartelId);
  }

  @Get(':id')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO, RolNombre.CAPATAZ)
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.pesajeVendimiaService.findById(id, user.empresaId);
  }

  @Post()
  @Auditar({ accion: 'REGISTRAR_PESAJE', entidad: 'pesaje_vendimia' })
  @Roles(RolNombre.CAPATAZ, RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  async registrarUno(
    @Body() dto: CreatePesajeDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.alcance.verificarCuartel(dto.cuartelId, user.empresaId);
    await this.alcance.verificarCuadrilla(dto.cuadrillaId, user.empresaId);
    const resultado = await this.pesajeVendimiaService.registrarUno(
      dto,
      user.id,
    );
    // HU-14: 201 al crear, 200 si el `local_uuid` ya estaba sincronizado.
    res.status(resultado.yaExistia ? HttpStatus.OK : HttpStatus.CREATED);
    return resultado;
  }

  @Post('sync')
  @Auditar({
    accion: 'SINCRONIZAR_PESAJES',
    entidad: 'pesaje_vendimia',
    datos: 'ninguno',
  })
  @Roles(RolNombre.CAPATAZ, RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  async sincronizarLote(
    @Body() dto: SyncPesajeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Se verifica el lote completo antes de procesarlo, para que un pesaje
    // dirigido a otra empresa no entre en el batch.
    const cuartelIds = [...new Set(dto.pesajes.map((p) => p.cuartelId))];
    for (const cuartelId of cuartelIds) {
      await this.alcance.verificarCuartel(cuartelId, user.empresaId);
    }
    const cuadrillaIds = [...new Set(dto.pesajes.map((p) => p.cuadrillaId))];
    for (const cuadrillaId of cuadrillaIds) {
      await this.alcance.verificarCuadrilla(cuadrillaId, user.empresaId);
    }
    return this.pesajeVendimiaService.sincronizarLote(dto.pesajes, user.id);
  }
}
