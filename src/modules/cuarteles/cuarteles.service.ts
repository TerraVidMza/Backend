import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsOrder, FindOptionsWhere, ILike, Repository } from 'typeorm';
import { Cuartel } from './entities/cuartel.entity';
import { CreateCuartelDto } from './dto/create-cuartel.dto';
import { UpdateCuartelDto } from './dto/update-cuartel.dto';
import { ListarCuartelesDto } from './dto/listar-cuarteles.dto';
import { RegistroLabor } from '../registro-labor/entities/registro-labor.entity';
import { PesajeVendimia } from '../pesaje-vendimia/entities/pesaje-vendimia.entity';
import { CatalogoItem } from '../catalogo-item/entities/catalogo-item.entity';
import {
  armarResultado,
  calcularPaginacion,
  ResultadoPaginado,
} from '../../common/dto/pagination-query.dto';
import { rangoDeFechasComoTexto } from '../../common/fechas/rango-fechas';
import { CampaniasService } from '../campanias/campanias.service';

@Injectable()
export class CuartelesService {
  constructor(
    @InjectRepository(Cuartel)
    private readonly cuartelRepository: Repository<Cuartel>,
    @InjectRepository(RegistroLabor)
    private readonly registroLaborRepository: Repository<RegistroLabor>,
    @InjectRepository(PesajeVendimia)
    private readonly pesajeRepository: Repository<PesajeVendimia>,
    private readonly campaniasService: CampaniasService,
  ) {}

  findByFinca(fincaId: string): Promise<Cuartel[]> {
    return this.cuartelRepository.find({
      where: { fincaId, activo: true },
      relations: { variedad: true, sistemaConduccion: true },
      order: { nombre: 'ASC' },
    });
  }

  /**
   * Búsqueda de cuarteles a nivel de empresa con filtros y orden (HU-11).
   *
   * El alcance sale siempre de `empresaId` siguiendo `cuartel → finca`, así que
   * un `fincaId` de otra empresa devuelve vacío en lugar de filtrar.
   */
  async buscar(
    empresaId: string,
    query: ListarCuartelesDto = {},
  ): Promise<ResultadoPaginado<Cuartel>> {
    const { page, pageSize, skip, take } = calcularPaginacion(query);

    const where: FindOptionsWhere<Cuartel> = {
      finca: { empresaId, ...(query.fincaId ? { id: query.fincaId } : {}) },
      // Por defecto solo los activos: un cuartel dado de baja no debería
      // aparecer en el buscador salvo que se lo pida explícitamente.
      activo: query.activo ?? true,
    };
    if (query.buscar) where.nombre = ILike(`%${query.buscar}%`);
    if (query.variedadId) where.variedadId = query.variedadId;
    if (query.estado) where.estado = query.estado;
    if (query.anioImplantacion) where.anioImplantacion = query.anioImplantacion;

    // La lista blanca del DTO es lo que impide inyectar una columna arbitraria
    // en el ORDER BY.
    const order = {
      [query.ordenarPor ?? 'nombre']: query.orden ?? 'ASC',
    } as FindOptionsOrder<Cuartel>;

    const resultado = await this.cuartelRepository.findAndCount({
      where,
      relations: { variedad: true, sistemaConduccion: true, finca: true },
      order,
      skip,
      take,
    });

    return armarResultado(resultado, page, pageSize);
  }

  /**
   * Variedades efectivamente plantadas en una finca (HU-11).
   *
   * Alimenta el desplegable del filtro: ofrecer el catálogo completo lleva a
   * elegir variedades que no existen en esa finca y obtener cero resultados.
   */
  async variedadesDeFinca(fincaId: string): Promise<CatalogoItem[]> {
    const filas = await this.cuartelRepository.find({
      where: { fincaId, activo: true },
      relations: { variedad: true },
      select: { id: true },
    });

    const porId = new Map<string, CatalogoItem>();
    for (const fila of filas) {
      if (fila.variedad) porId.set(fila.variedad.id, fila.variedad);
    }
    return [...porId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  async findById(id: string): Promise<Cuartel> {
    const cuartel = await this.cuartelRepository.findOne({
      where: { id },
      relations: { finca: true, variedad: true, sistemaConduccion: true },
    });
    if (!cuartel) {
      throw new NotFoundException('Cuartel no encontrado');
    }
    return cuartel;
  }

  create(dto: CreateCuartelDto): Promise<Cuartel> {
    const cuartel = this.cuartelRepository.create({ ...dto, activo: true });
    return this.cuartelRepository.save(cuartel);
  }

  async update(id: string, dto: UpdateCuartelDto): Promise<Cuartel> {
    const cuartel = await this.findById(id);
    Object.assign(cuartel, dto);
    return this.cuartelRepository.save(cuartel);
  }

  /**
   * Baja lógica del cuartel (HU-09).
   *
   * Se bloquea si tiene labores o pesajes **de la campaña actual**: el histórico
   * de costos y la trazabilidad de la cosecha cuelgan de él, y darlo de baja lo
   * saca de los listados dejando esos registros sin contexto.
   *
   * El recorte por campaña es el que pide el criterio y llegó con `D-014`. Antes
   * se contaba todo el histórico, así que un cuartel con una labor de hace cinco
   * años quedaba imposible de dar de baja para siempre — más restrictivo que la
   * HU, no menos, pero igual de incorrecto.
   *
   * **Sin campaña definida se sigue contando todo el histórico.** Es el lado
   * conservador: negar una baja reversible es más barato que ocultar un cuartel
   * con registros vivos.
   */
  async desactivar(id: string, empresaId?: string): Promise<Cuartel> {
    const cuartel = await this.findById(id);

    const campania = empresaId
      ? await this.campaniasService.getActual(empresaId)
      : null;
    const rango = campania
      ? rangoDeFechasComoTexto(campania.fechaDesde, campania.fechaHasta)
      : undefined;
    const filtro = rango ? { cuartelId: id, fecha: rango } : { cuartelId: id };

    const [labores, pesajes] = await Promise.all([
      this.registroLaborRepository.count({ where: filtro }),
      this.pesajeRepository.count({ where: filtro }),
    ]);

    if (labores > 0 || pesajes > 0) {
      const periodo = campania
        ? ` en la campaña actual ("${campania.nombre}")`
        : '';
      throw new ConflictException(
        `El cuartel tiene ${labores} labor(es) y ${pesajes} pesaje(s) registrados${periodo}, así que no puede darse de baja sin perder su trazabilidad.`,
      );
    }

    cuartel.activo = false;
    return this.cuartelRepository.save(cuartel);
  }

  /** Cuarteles activos por finca, para el contador del listado (HU-08). */
  async contarActivosPorFinca(
    fincaIds: string[],
  ): Promise<Map<string, number>> {
    if (fincaIds.length === 0) return new Map();

    const filas = await this.cuartelRepository
      .createQueryBuilder('c')
      .select('c.finca_id', 'fincaId')
      .addSelect('COUNT(*)', 'total')
      .where('c.finca_id IN (:...fincaIds)', { fincaIds })
      .andWhere('c.activo = true')
      .groupBy('c.finca_id')
      .getRawMany<{ fincaId: string; total: string }>();

    return new Map(filas.map((f) => [f.fincaId, Number(f.total)]));
  }

  /** Cantidad de cuarteles activos de una finca; usado para bloquear su baja. */
  contarActivos(fincaId: string): Promise<number> {
    return this.cuartelRepository.count({ where: { fincaId, activo: true } });
  }
}
