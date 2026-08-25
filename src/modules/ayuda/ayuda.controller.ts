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
import { ArticulosAyudaService } from './articulos-ayuda.service';
import { TicketSoporteService } from './ticket-soporte.service';
import { CreateArticuloDto } from './dto/create-articulo.dto';
import { UpdateArticuloDto } from './dto/update-articulo.dto';
import { CrearTicketDto } from './dto/crear-ticket.dto';
import { ListarArticulosDto } from './dto/listar-articulos.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AnyRole } from '../../common/decorators/any-role.decorator';
import { RolNombre } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Auditar } from '../../common/audit/auditar.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ayuda')
export class AyudaController {
  constructor(
    private readonly articulosAyudaService: ArticulosAyudaService,
    private readonly ticketSoporteService: TicketSoporteService,
  ) {}

  // El manual y las FAQ son para todos los roles (HU-36).
  @AnyRole()
  @Get('articulos')
  findArticulos(@Query() query: ListarArticulosDto) {
    return this.articulosAyudaService.findAll(query.tipo, query.modulo);
  }

  @Post('articulos')
  @Auditar({ accion: 'CREAR_ARTICULO', entidad: 'articulo_ayuda' })
  @Roles(RolNombre.PROPIETARIO)
  createArticulo(@Body() dto: CreateArticuloDto) {
    return this.articulosAyudaService.create(dto);
  }

  @Patch('articulos/:id')
  @Auditar({
    accion: 'ACTUALIZAR_ARTICULO',
    entidad: 'articulo_ayuda',
    idDesde: 'param:id',
  })
  @Roles(RolNombre.PROPIETARIO)
  updateArticulo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateArticuloDto,
  ) {
    return this.articulosAyudaService.update(id, dto);
  }

  @Patch('articulos/:id/desactivar')
  @Auditar({
    accion: 'DESACTIVAR_ARTICULO',
    entidad: 'articulo_ayuda',
    idDesde: 'param:id',
  })
  @Roles(RolNombre.PROPIETARIO)
  desactivarArticulo(@Param('id', ParseUUIDPipe) id: string) {
    return this.articulosAyudaService.desactivar(id);
  }

  // Cualquier usuario puede pedir soporte (HU-36).
  @AnyRole()
  @Post('tickets')
  @Auditar({ accion: 'CREAR_TICKET', entidad: 'ticket_soporte' })
  crearTicket(
    @Body() dto: CrearTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketSoporteService.crear(dto, user.id);
  }

  @Get('tickets')
  @Roles(RolNombre.PROPIETARIO)
  findTickets(@CurrentUser() user: AuthenticatedUser) {
    return this.ticketSoporteService.findAll(user.empresaId);
  }
}
