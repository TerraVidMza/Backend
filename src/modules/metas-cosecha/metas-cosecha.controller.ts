import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MetasCosechaService } from './metas-cosecha.service';
import { FijarMetaDto } from './dto/fijar-meta.dto';
import { AvanceQueryDto } from './dto/avance-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolNombre } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AlcanceEmpresaService } from '../../common/tenant/alcance-empresa.service';
import { Auditar } from '../../common/audit/auditar.decorator';

/** Metas de cosecha y avance de la campaña (D-027). */
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Vendimia')
@ApiBearerAuth('jwt')
@Controller('campanias')
export class MetasCosechaController {
  constructor(
    private readonly metas: MetasCosechaService,
    private readonly alcance: AlcanceEmpresaService,
  ) {}

  /** Lo usa la app de campo para el indicador de avance. */
  @Get('actual/avance')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO, RolNombre.CAPATAZ)
  async avanceActual(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AvanceQueryDto,
  ) {
    if (query.fincaId) {
      await this.alcance.verificarFinca(query.fincaId, user.empresaId);
    }
    return this.metas.avanceActual(user.empresaId, query.fincaId);
  }

  /** Para cargar las metas desde la Web. */
  @Get(':id/avance')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO, RolNombre.CAPATAZ)
  async avance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AvanceQueryDto,
  ) {
    if (query.fincaId) {
      await this.alcance.verificarFinca(query.fincaId, user.empresaId);
    }
    return this.metas.avancePorCampania(id, user.empresaId, query.fincaId);
  }

  @Put(':id/metas/:cuartelId')
  @Roles(RolNombre.PROPIETARIO)
  @Auditar({ accion: 'FIJAR_META_COSECHA', entidad: 'meta_cosecha' })
  async fijar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('cuartelId', ParseUUIDPipe) cuartelId: string,
    @Body() dto: FijarMetaDto,
  ) {
    await this.alcance.verificarCuartel(cuartelId, user.empresaId);
    return this.metas.fijar(id, cuartelId, dto.metaKg, user.id, user.empresaId);
  }
}
