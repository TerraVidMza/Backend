import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cuartel } from './entities/cuartel.entity';
import { CuartelesService } from './cuarteles.service';
import { CuartelesController } from './cuarteles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Cuartel])],
  providers: [CuartelesService],
  controllers: [CuartelesController],
  exports: [CuartelesService],
})
export class CuartelesModule {}
