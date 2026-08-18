import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TokenRecuperacion } from './entities/token-recuperacion.entity';
import { TokenRecuperacionService } from './token-recuperacion.service';

@Module({
  imports: [TypeOrmModule.forFeature([TokenRecuperacion])],
  providers: [TokenRecuperacionService],
  exports: [TokenRecuperacionService],
})
export class TokenRecuperacionModule {}
