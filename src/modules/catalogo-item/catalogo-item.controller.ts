import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CatalogoItemService } from './catalogo-item.service';
import { CreateCatalogoItemDto } from './dto/create-catalogo-item.dto';
import { UpdateCatalogoItemDto } from './dto/update-catalogo-item.dto';
import { CatalogoTipo } from './entities/catalogo-item.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AnyRole } from '../../common/decorators/any-role.decorator';
import { RolNombre } from '../../common/enums/rol.enum';
import { Auditar } from '../../common/audit/auditar.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('catalogos')
export class CatalogoItemController {
  constructor(private readonly catalogoItemService: CatalogoItemService) {}

  // Catálogo de solo lectura para poblar selectores: lo consume cualquier rol.
  @AnyRole()
  @Get()
  findByTipo(
    @CurrentUser() user: AuthenticatedUser,
    @Query('tipo') tipo: CatalogoTipo,
    @Query('incluirInactivos') incluirInactivos?: string,
  ) {
    return this.catalogoItemService.findByTipo(
      tipo,
      user.empresaId,
      incluirInactivos !== 'true',
    );
  }

  @Post()
  @Auditar({ accion: 'CREAR_CATALOGO', entidad: 'catalogo_item' })
  @Roles(RolNombre.PROPIETARIO)
  create(
    @Body() dto: CreateCatalogoItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.catalogoItemService.create(dto, user.empresaId);
  }

  @Patch(':id')
  @Auditar({
    accion: 'ACTUALIZAR_CATALOGO',
    entidad: 'catalogo_item',
    idDesde: 'param:id',
  })
  @Roles(RolNombre.PROPIETARIO)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCatalogoItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.catalogoItemService.update(id, dto, user.empresaId);
  }

  @Patch(':id/desactivar')
  @Auditar({
    accion: 'DESACTIVAR_CATALOGO',
    entidad: 'catalogo_item',
    idDesde: 'param:id',
  })
  @Roles(RolNombre.PROPIETARIO)
  desactivar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.catalogoItemService.desactivar(id, user.empresaId);
  }

  @Delete(':id')
  @Auditar({
    accion: 'ELIMINAR_CATALOGO',
    entidad: 'catalogo_item',
    idDesde: 'param:id',
  })
  @Roles(RolNombre.PROPIETARIO)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.catalogoItemService.remove(id, user.empresaId);
  }
}
