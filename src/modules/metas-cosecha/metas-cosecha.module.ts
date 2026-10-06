import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetaCosecha } from './entities/meta-cosecha.entity';
import { MetasCosechaService } from './metas-cosecha.service';
import { MetasCosechaController } from './metas-cosecha.controller';

/** `CampaniasModule` es global; `AlcanceEmpresaService` también. */
@Module({
  imports: [TypeOrmModule.forFeature([MetaCosecha])],
  providers: [MetasCosechaService],
  controllers: [MetasCosechaController],
})
export class MetasCosechaModule {}
