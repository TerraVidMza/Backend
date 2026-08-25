import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Finca } from '../../modules/fincas/entities/finca.entity';
import { Cuartel } from '../../modules/cuarteles/entities/cuartel.entity';
import { Sensor } from '../../modules/sensores/entities/sensor.entity';
import { Cuadrilla } from '../../modules/cuadrillas/entities/cuadrilla.entity';
import { TipoLabor } from '../../modules/tipo-labor/entities/tipo-labor.entity';
import { Insumo } from '../../modules/insumos/entities/insumo.entity';

/**
 * Verifica que un recurso pertenezca a la empresa del usuario autenticado.
 *
 * TerraVid es multi-tenant: todo cuelga de `empresa` a través de `finca`.
 *
 *     empresa → finca → cuartel  → labores, pesajes, remitos
 *                     → sensor   → lecturas, umbrales, alertas
 *                     → cuadrilla → tarifas
 *             → catalogo_item, insumos, tipos_labor → costos   (D-h)
 *
 * Los servicios de dominio resuelven por id sin mirar la empresa, así que sin
 * esta verificación cualquier usuario que conociera un UUID podía leer —y en el
 * caso de los remitos, aprobar— recursos de otra empresa.
 *
 * Se lanza 404 y no 403 a propósito: un 403 confirmaría que el recurso existe
 * en otro tenant.
 */
@Injectable()
export class AlcanceEmpresaService {
  constructor(
    @InjectRepository(Finca)
    private readonly fincaRepository: Repository<Finca>,
    @InjectRepository(Cuartel)
    private readonly cuartelRepository: Repository<Cuartel>,
    @InjectRepository(Sensor)
    private readonly sensorRepository: Repository<Sensor>,
    @InjectRepository(Cuadrilla)
    private readonly cuadrillaRepository: Repository<Cuadrilla>,
    @InjectRepository(TipoLabor)
    private readonly tipoLaborRepository: Repository<TipoLabor>,
    @InjectRepository(Insumo)
    private readonly insumoRepository: Repository<Insumo>,
  ) {}

  async verificarFinca(fincaId: string, empresaId: string): Promise<void> {
    const existe = await this.fincaRepository.exists({
      where: { id: fincaId, empresaId },
    });
    if (!existe) {
      throw new NotFoundException('Finca no encontrada');
    }
  }

  async verificarCuartel(cuartelId: string, empresaId: string): Promise<void> {
    const existe = await this.cuartelRepository.exists({
      where: { id: cuartelId, finca: { empresaId } },
      relations: { finca: true },
    });
    if (!existe) {
      throw new NotFoundException('Cuartel no encontrado');
    }
  }

  async verificarSensor(sensorId: string, empresaId: string): Promise<void> {
    const existe = await this.sensorRepository.exists({
      where: { id: sensorId, finca: { empresaId } },
      relations: { finca: true },
    });
    if (!existe) {
      throw new NotFoundException('Sensor no encontrado');
    }
  }

  async verificarCuadrilla(
    cuadrillaId: string,
    empresaId: string,
  ): Promise<void> {
    const existe = await this.cuadrillaRepository.exists({
      where: { id: cuadrillaId, finca: { empresaId } },
      relations: { finca: true },
    });
    if (!existe) {
      throw new NotFoundException('Cuadrilla no encontrada');
    }
  }

  /**
   * Los catálogos maestros cuelgan de `empresa` directamente (D-h).
   *
   * Antes eran globales a la instancia, así que la sincronización no necesitaba
   * verificarlos. Ahora sí: sin esto, un registro de labor podría referenciar el
   * tipo de labor de otra empresa y **aplicar sus costos**.
   */
  async verificarTipoLabor(
    tipoLaborId: string,
    empresaId: string,
  ): Promise<void> {
    const existe = await this.tipoLaborRepository.exists({
      where: { id: tipoLaborId, empresaId },
    });
    if (!existe) {
      throw new NotFoundException('Tipo de labor no encontrado');
    }
  }

  /** Verifica varios insumos de una vez, para no hacer N consultas por lote. */
  async verificarInsumos(
    insumoIds: string[],
    empresaId: string,
  ): Promise<void> {
    const unicos = [...new Set(insumoIds)];
    if (unicos.length === 0) return;

    const encontrados = await this.insumoRepository.count({
      where: { id: In(unicos), empresaId },
    });
    if (encontrados !== unicos.length) {
      throw new NotFoundException(
        'Alguno de los insumos indicados no existe en el catálogo de la empresa.',
      );
    }
  }

  /** Ids de cuarteles de la empresa; útil para acotar listados agregados. */
  async cuartelIdsDeEmpresa(empresaId: string): Promise<string[]> {
    const fincas = await this.fincaRepository.find({
      where: { empresaId },
      select: { id: true },
    });
    if (fincas.length === 0) return [];
    const cuarteles = await this.cuartelRepository.find({
      where: { fincaId: In(fincas.map((f) => f.id)) },
      select: { id: true },
    });
    return cuarteles.map((c) => c.id);
  }
}
