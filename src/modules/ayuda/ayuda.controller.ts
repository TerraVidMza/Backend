import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ArticulosAyudaService } from './articulos-ayuda.service';
import { TicketSoporteService } from './ticket-soporte.service';
import { CreateArticuloDto } from './dto/create-articulo.dto';
import { UpdateArticuloDto } from './dto/update-articulo.dto';
import { CrearTicketDto } from './dto/crear-ticket.dto';
import { ModuloAyuda, TipoArticulo } from './entities/articulo-ayuda.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolNombre } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ayuda')
export class AyudaController {
  constructor(
    private readonly articulosAyudaService: ArticulosAyudaService,
    private readonly ticketSoporteService: TicketSoporteService,
  ) {}

  @Get('articulos')
  findArticulos(@Query('tipo') tipo?: TipoArticulo, @Query('modulo') modulo?: ModuloAyuda) {
    return this.articulosAyudaService.findAll(tipo, modulo);
  }

  @Post('articulos')
  @Roles(RolNombre.PROPIETARIO)
  createArticulo(@Body() dto: CreateArticuloDto) {
    return this.articulosAyudaService.create(dto);
  }

  @Patch('articulos/:id')
  @Roles(RolNombre.PROPIETARIO)
  updateArticulo(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateArticuloDto) {
    return this.articulosAyudaService.update(id, dto);
  }

  @Patch('articulos/:id/desactivar')
  @Roles(RolNombre.PROPIETARIO)
  desactivarArticulo(@Param('id', ParseUUIDPipe) id: string) {
    return this.articulosAyudaService.desactivar(id);
  }

  @Post('tickets')
  crearTicket(@Body() dto: CrearTicketDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ticketSoporteService.crear(dto, user.id);
  }

  @Get('tickets')
  @Roles(RolNombre.PROPIETARIO)
  findTickets() {
    return this.ticketSoporteService.findAll();
  }
}
