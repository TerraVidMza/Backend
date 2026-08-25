import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campania } from './entities/campania.entity';
import { CreateCampaniaDto } from './dto/create-campania.dto';
import { UpdateCampaniaDto } from './dto/update-campania.dto';
import { hoyLocal } from '../../common/fechas/rango-fechas';

/** Rango cerrado `[desde, hasta]` sobre columnas `date`. */
export interface RangoCampania {
  desde: string;
  hasta: string;
  campaniaId: string | null;
  nombre: string | null;
}

const soloFecha = (valor: string): string => valor.slice(0, 10);

@Injectable()
export class CampaniasService {
  constructor(
    @InjectRepository(Campania)
    private readonly campaniaRepository: Repository<Campania>,
  ) {}

  async findAll(empresaId: string): Promise<Campania[]> {
    return this.campaniaRepository.find({
      where: { empresaId },
      order: { fechaDesde: 'DESC' },
    });
  }

  async findById(id: string, empresaId: string): Promise<Campania> {
    const campania = await this.campaniaRepository.findOne({
      where: { id, empresaId },
    });
    if (!campania) {
      throw new NotFoundException('Campaña no encontrada');
    }
    return campania;
  }

  async create(dto: CreateCampaniaDto, empresaId: string): Promise<Campania> {
    const desde = soloFecha(dto.fechaDesde);
    const hasta = soloFecha(dto.fechaHasta);
    this.validarRango(desde, hasta);

    // El solapamiento lo rechaza la restricción EXCLUDE de la base; acá se
    // consulta primero solo para poder decir CUÁL campaña choca, que es lo que
    // el usuario necesita para corregir.
    await this.rechazarSiSeSolapa(empresaId, desde, hasta, null);

    const campania = this.campaniaRepository.create({
      empresaId,
      nombre: dto.nombre,
      fechaDesde: desde,
      fechaHasta: hasta,
    });
    return this.campaniaRepository.save(campania);
  }

  async update(
    id: string,
    empresaId: string,
    dto: UpdateCampaniaDto,
  ): Promise<Campania> {
    const campania = await this.findById(id, empresaId);

    const desde = dto.fechaDesde
      ? soloFecha(dto.fechaDesde)
      : campania.fechaDesde;
    const hasta = dto.fechaHasta
      ? soloFecha(dto.fechaHasta)
      : campania.fechaHasta;
    this.validarRango(desde, hasta);
    await this.rechazarSiSeSolapa(empresaId, desde, hasta, id);

    campania.nombre = dto.nombre ?? campania.nombre;
    campania.fechaDesde = desde;
    campania.fechaHasta = hasta;
    return this.campaniaRepository.save(campania);
  }

  /**
   * Cerrar una campaña no borra nada ni bloquea la carga de registros con fecha
   * dentro de su rango: solo deja de ser «la actual» para los indicadores. Es
   * reversible por eso mismo — cerrarla por error no debería costar datos.
   */
  async setCerrada(
    id: string,
    empresaId: string,
    cerrada: boolean,
  ): Promise<Campania> {
    const campania = await this.findById(id, empresaId);
    campania.cerrada = cerrada;
    return this.campaniaRepository.save(campania);
  }

  /**
   * La campaña abierta que contiene el día de hoy, o `null` si no hay ninguna.
   *
   * Devolver `null` en vez de inventar un rango es deliberado: cada consumidor
   * decide su comportamiento sin campaña definida, y esa decisión no es la
   * misma en todos lados —la baja de un cuartel prefiere ser más restrictiva,
   * el dashboard prefiere mostrar algo—.
   */
  async getActual(empresaId: string): Promise<Campania | null> {
    return this.campaniaRepository
      .createQueryBuilder('c')
      .where('c.empresa_id = :empresaId', { empresaId })
      .andWhere('c.cerrada = false')
      .andWhere(':hoy::date BETWEEN c.fecha_desde AND c.fecha_hasta', {
        hoy: hoyLocal(),
      })
      .orderBy('c.fecha_desde', 'DESC')
      .getOne();
  }

  /** Rango de una campaña concreta, para los endpoints que la reciben por id. */
  async getRango(id: string, empresaId: string): Promise<RangoCampania> {
    const campania = await this.findById(id, empresaId);
    return {
      desde: campania.fechaDesde,
      hasta: campania.fechaHasta,
      campaniaId: campania.id,
      nombre: campania.nombre,
    };
  }

  private validarRango(desde: string, hasta: string): void {
    if (hasta <= desde) {
      throw new BadRequestException(
        'La fecha de fin de la campaña debe ser posterior a la de inicio.',
      );
    }
  }

  private async rechazarSiSeSolapa(
    empresaId: string,
    desde: string,
    hasta: string,
    excluirId: string | null,
  ): Promise<void> {
    const query = this.campaniaRepository
      .createQueryBuilder('c')
      .where('c.empresa_id = :empresaId', { empresaId })
      // Dos rangos cerrados se tocan si cada uno empieza antes de que termine
      // el otro. Comparación texto contra texto sobre columnas `date`, que no
      // tienen hora ni huso (D-009).
      .andWhere('c.fecha_desde <= :hasta', { hasta })
      .andWhere('c.fecha_hasta >= :desde', { desde });

    if (excluirId) {
      query.andWhere('c.id != :excluirId', { excluirId });
    }

    const solapada = await query.getOne();
    if (solapada) {
      throw new ConflictException(
        `El rango se superpone con la campaña "${solapada.nombre}" (${solapada.fechaDesde} — ${solapada.fechaHasta}).`,
      );
    }
  }
}
