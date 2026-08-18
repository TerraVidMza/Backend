import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArticuloAyuda } from './entities/articulo-ayuda.entity';
import { TicketSoporte } from './entities/ticket-soporte.entity';
import { ArticulosAyudaService } from './articulos-ayuda.service';
import { TicketSoporteService } from './ticket-soporte.service';
import { AyudaController } from './ayuda.controller';
import { ConfiguracionModule } from '../configuracion/configuracion.module';
import { UsuariosModule } from '../usuarios/usuarios.module';

@Module({
  imports: [TypeOrmModule.forFeature([ArticuloAyuda, TicketSoporte]), ConfiguracionModule, UsuariosModule],
  providers: [ArticulosAyudaService, TicketSoporteService],
  controllers: [AyudaController],
})
export class AyudaModule {}
