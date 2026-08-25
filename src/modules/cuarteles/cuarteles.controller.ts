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
import { ListarCuartelesDto } from './dto/listar-cuarteles.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolNombre } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AlcanceEmpresaService } from '../../common/tenant/alcance-empresa.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Auditar } from '../../common/audit/auditar.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cuarteles')
export class CuartelesController {
  constructor(
    private readonly cuartelesService: CuartelesService,
    private readonly alcance: AlcanceEmpresaService,
  ) {}

  // El Auditor queda excluido a propósito: HU-07 acota su alcance al log de
  // auditoría y al historial de operaciones por cuartel (HU-17).
  @Get()
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO, RolNombre.CAPATAZ)
  async findByFinca(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fincaId', ParseUUIDPipe) fincaId: string,
  ) {
    await this.alcance.verificarFinca(fincaId, user.empresaId);
    return this.cuartelesService.findByFinca(fincaId);
  }

  /**
   * Búsqueda de HU-11: atraviesa toda la empresa, con filtros por variedad,
   * estado y año, y orden configurable. `GET /cuarteles?fincaId=` sigue
   * sirviendo el caso de una sola finca.
   */
  @Get('buscar')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO, RolNombre.CAPATAZ)
  buscar(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListarCuartelesDto,
  ) {
    return this.cuartelesService.buscar(user.empresaId, query);
  }

  /** Variedades presentes en una finca, para poblar el filtro de HU-11. */
  @Get('variedades')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO, RolNombre.CAPATAZ)
  async variedades(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fincaId', ParseUUIDPipe) fincaId: string,
  ) {
    await this.alcance.verificarFinca(fincaId, user.empresaId);
    return this.cuartelesService.variedadesDeFinca(fincaId);
  }

  // Va después de las rutas literales: `:id` capturaría "buscar" y "variedades".
  @Get(':id')
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO, RolNombre.CAPATAZ)
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.alcance.verificarCuartel(id, user.empresaId);
    return this.cuartelesService.findById(id);
  }

  @Post()
  @Auditar({ accion: 'CREAR_CUARTEL', entidad: 'cuartel' })
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCuartelDto,
  ) {
    await this.alcance.verificarFinca(dto.fincaId, user.empresaId);
    return this.cuartelesService.create(dto);
  }

  @Patch(':id')
  @Auditar({
    accion: 'ACTUALIZAR_CUARTEL',
    entidad: 'cuartel',
    idDesde: 'param:id',
  })
  @Roles(RolNombre.PROPIETARIO, RolNombre.AGRONOMO)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCuartelDto,
  ) {
    await this.alcance.verificarCuartel(id, user.empresaId);
    return this.cuartelesService.update(id, dto);
  }

  @Patch(':id/desactivar')
  @Auditar({
    accion: 'DESACTIVAR_CUARTEL',
    entidad: 'cuartel',
    idDesde: 'param:id',
  })
  @Roles(RolNombre.PROPIETARIO)
  async desactivar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.alcance.verificarCuartel(id, user.empresaId);
    return this.cuartelesService.desactivar(id);
  }
}
