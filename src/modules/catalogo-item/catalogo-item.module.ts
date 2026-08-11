import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogoItem } from './entities/catalogo-item.entity';
import { Cuartel } from '../cuarteles/entities/cuartel.entity';
import { CatalogoItemService } from './catalogo-item.service';
import { CatalogoItemController } from './catalogo-item.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CatalogoItem, Cuartel])],
  providers: [CatalogoItemService],
  controllers: [CatalogoItemController],
  exports: [CatalogoItemService],
})
export class CatalogoItemModule {}
