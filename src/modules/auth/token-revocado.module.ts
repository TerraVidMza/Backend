import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TokenRevocado } from './entities/token-revocado.entity';
import { TokenRevocadoService } from './token-revocado.service';

/**
 * Módulo propio, y no parte de `AuthModule`, para que la tarea programada que
 * purga las revocaciones vencidas no tenga que arrastrar todo `AuthModule`
 * —con su `JwtModule`, su estrategia y su controlador— solo para borrar filas.
 */
@Module({
  imports: [TypeOrmModule.forFeature([TokenRevocado])],
  providers: [TokenRevocadoService],
  exports: [TokenRevocadoService],
})
export class TokenRevocadoModule {}
