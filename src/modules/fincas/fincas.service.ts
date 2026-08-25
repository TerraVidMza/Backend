import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Finca } from './entities/finca.entity';
import { CreateFincaDto } from './dto/create-finca.dto';
import { UpdateFincaDto } from './dto/update-finca.dto';
import { CuartelesService } from '../cuarteles/cuarteles.service';

@Injectable()
export class FincasService {
  constructor(
    @InjectRepository(Finca)
    private readonly fincaRepository: Repository<Finca>,
    private readonly cuartelesService: CuartelesService,
  ) {}

  /**
   * Listado de fincas con la cantidad de cuarteles activos de cada una (HU-08).
   *
   * El contador se resuelve con **una** consulta agrupada para todas las fincas
   * de la página, no con una por fila: el listado es la pantalla de entrada de
   * la app y el N+1 se nota enseguida.
   */
  async findAll(
    empresaId: string,
    search?: string,
  ): Promise<Array<Finca & { cuartelesActivos: number }>> {
    const fincas = await this.fincaRepository.find({
      where: {
        empresaId,
        activa: true,
        ...(search ? { nombre: ILike(`%${search}%`) } : {}),
      },
      order: { nombre: 'ASC' },
    });

    const conteos = await this.cuartelesService.contarActivosPorFinca(
      fincas.map((f) => f.id),
    );

    return fincas.map((finca) =>
      Object.assign(finca, { cuartelesActivos: conteos.get(finca.id) ?? 0 }),
    );
  }

  /** `empresaId` acota al tenant: sin él, cualquier UUID válido era legible. */
  async findById(id: string, empresaId: string): Promise<Finca> {
    const finca = await this.fincaRepository.findOne({
      where: { id, empresaId },
    });
    if (!finca) {
      throw new NotFoundException('Finca no encontrada');
    }
    return finca;
  }

  create(
    dto: CreateFincaDto,
    createdById: string,
    empresaId: string,
  ): Promise<Finca> {
    const finca = this.fincaRepository.create({
      ...dto,
      empresaId,
      createdById,
      activa: true,
    });
    return this.fincaRepository.save(finca);
  }

  async update(
    id: string,
    dto: UpdateFincaDto,
    empresaId: string,
  ): Promise<Finca> {
    const finca = await this.findById(id, empresaId);
    Object.assign(finca, dto);
    return this.fincaRepository.save(finca);
  }

  /**
   * Baja lógica de la finca (HU-08).
   *
   * Se bloquea con 409 si todavía tiene cuarteles activos: la baja no cascadea,
   * así que los cuarteles quedaban activos colgando de una finca invisible —no
   * aparecían en ningún listado, pero seguían aceptando labores y pesajes—.
   */
  async desactivar(id: string, empresaId: string): Promise<Finca> {
    const finca = await this.findById(id, empresaId);

    const cuartelesActivos = await this.cuartelesService.contarActivos(id);
    if (cuartelesActivos > 0) {
      throw new ConflictException(
        `La finca tiene ${cuartelesActivos} cuartel(es) activo(s). Dales de baja primero.`,
      );
    }

    finca.activa = false;
    return this.fincaRepository.save(finca);
  }
}
