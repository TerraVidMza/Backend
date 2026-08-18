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
import { RolNombre } from '../../common/enums/rol.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('catalogos')
export class CatalogoItemController {
  constructor(private readonly catalogoItemService: CatalogoItemService) {}

  @Get()
  findByTipo(
    @Query('tipo') tipo: CatalogoTipo,
    @Query('incluirInactivos') incluirInactivos?: string,
  ) {
    return this.catalogoItemService.findByTipo(
      tipo,
      incluirInactivos !== 'true',
    );
  }

  @Post()
  @Roles(RolNombre.PROPIETARIO)
  create(@Body() dto: CreateCatalogoItemDto) {
    return this.catalogoItemService.create(dto);
  }

  @Patch(':id')
  @Roles(RolNombre.PROPIETARIO)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCatalogoItemDto,
  ) {
    return this.catalogoItemService.update(id, dto);
  }

  @Patch(':id/desactivar')
  @Roles(RolNombre.PROPIETARIO)
  desactivar(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogoItemService.desactivar(id);
  }

  @Delete(':id')
  @Roles(RolNombre.PROPIETARIO)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogoItemService.remove(id);
  }
}
