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
import { FincasService } from './fincas.service';
import { CreateFincaDto } from './dto/create-finca.dto';
import { UpdateFincaDto } from './dto/update-finca.dto';
import { ListarFincasDto } from './dto/listar-fincas.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolNombre } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Auditar } from '../../common/audit/auditar.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fincas')
export class FincasController {
  constructor(private readonly fincasService: FincasService) {}

  /**
   * El Auditor lee, pero no escribe (D-021).
   *
   * HU-17 le concede el historial de operaciones **por cuartel**, y ese
   * endpoint pide un `cuartelId`. Antes no tenía de dónde sacarlo: el listado
   * de fincas lo excluía y el de cuarteles también, así que su única historia
   * de negocio era inalcanzable salvo pegando un UUID a mano. La finca no
   * lleva ningún dato económico —nombre, ubicación, hectáreas y coordenadas—,
   * y el alta, la edición y la baja siguen siendo del Propietario.
   */
  @Get()
  @Roles(
    RolNombre.PROPIETARIO,
    RolNombre.AGRONOMO,
    RolNombre.CAPATAZ,
    RolNombre.AUDITOR,
  )
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListarFincasDto,
  ) {
    return this.fincasService.findAll(user.empresaId, query.search);
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
    return this.fincasService.findById(id, user.empresaId);
  }

  @Post()
  @Auditar({ accion: 'CREAR_FINCA', entidad: 'finca' })
  @Roles(RolNombre.PROPIETARIO)
  create(@Body() dto: CreateFincaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.fincasService.create(dto, user.id, user.empresaId);
  }

  @Patch(':id')
  @Auditar({
    accion: 'ACTUALIZAR_FINCA',
    entidad: 'finca',
    idDesde: 'param:id',
  })
  @Roles(RolNombre.PROPIETARIO)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFincaDto,
  ) {
    return this.fincasService.update(id, dto, user.empresaId);
  }

  @Patch(':id/desactivar')
  @Auditar({
    accion: 'DESACTIVAR_FINCA',
    entidad: 'finca',
    idDesde: 'param:id',
  })
  @Roles(RolNombre.PROPIETARIO)
  desactivar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.fincasService.desactivar(id, user.empresaId);
  }
}
