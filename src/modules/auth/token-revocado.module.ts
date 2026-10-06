import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TokenRevocado } from './entities/token-revocado.entity';
import { TokenRevocadoService } from './token-revocado.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { RefreshTokenService } from './refresh-token.service';

/**
 * Módulo propio, y no parte de `AuthModule`, para que la tarea programada que
 * purga las revocaciones y los refresh tokens vencidos no tenga que arrastrar
 * todo `AuthModule` —con su `JwtModule`, su estrategia y su controlador— solo
 * para borrar filas.
 */
@Module({
  imports: [TypeOrmModule.forFeature([TokenRevocado, RefreshToken])],
  providers: [TokenRevocadoService, RefreshTokenService],
  exports: [TokenRevocadoService, RefreshTokenService],
})
export class TokenRevocadoModule {}
