import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Insumo } from './entities/insumo.entity';
import { CostoInsumo } from './entities/costo-insumo.entity';
import { CreateInsumoDto } from './dto/create-insumo.dto';
import { UpdateInsumoDto } from './dto/update-insumo.dto';
import { SetCostoInsumoDto } from './dto/set-costo-insumo.dto';
import { hoyLocal } from '../../common/fechas/rango-fechas';

@Injectable()
export class InsumosService {
  constructor(
    @InjectRepository(Insumo)
    private readonly insumoRepository: Repository<Insumo>,
    @InjectRepository(CostoInsumo)
    private readonly costoInsumoRepository: Repository<CostoInsumo>,
  ) {}

  findAll(empresaId: string, soloActivos = true): Promise<Insumo[]> {
    return this.insumoRepository.find({
      where: soloActivos ? { empresaId, activo: true } : { empresaId },
      order: { nombre: 'ASC' },
    });
  }

  /**
   * `empresaId` acota al tenant: el catálogo es por empresa (D-h). Devuelve 404
   * y no 403 para un insumo de otra empresa, por el mismo criterio que el resto
   * del sistema: confirmar su existencia ya sería una filtración.
   */
  async findById(id: string, empresaId: string): Promise<Insumo> {
    const insumo = await this.insumoRepository.findOne({
      where: { id, empresaId },
    });
    if (!insumo) {
      throw new NotFoundException('Insumo no encontrado');
    }
    return insumo;
  }

  async create(
    dto: CreateInsumoDto,
    createdById: string,
    empresaId: string,
  ): Promise<Insumo> {
    const insumo = this.insumoRepository.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? null,
      unidadMedida: dto.unidadMedida,
      empresaId,
      activo: true,
    });
    const guardado = await this.insumoRepository.save(insumo);

    await this.setCosto(
      guardado.id,
      {
        costoUnitario: dto.costoUnitarioInicial,
        validFrom: hoyLocal(),
      },
      createdById,
      empresaId,
    );

    return guardado;
  }

  async update(
    id: string,
    dto: UpdateInsumoDto,
    empresaId: string,
  ): Promise<Insumo> {
    const insumo = await this.findById(id, empresaId);
    Object.assign(insumo, dto);
    return this.insumoRepository.save(insumo);
  }

  async desactivar(id: string, empresaId: string): Promise<Insumo> {
    const insumo = await this.findById(id, empresaId);
    insumo.activo = false;
    return this.insumoRepository.save(insumo);
  }

  async setCosto(
    insumoId: string,
    dto: SetCostoInsumoDto,
    createdById: string,
    empresaId: string,
  ): Promise<CostoInsumo> {
    // El costo hereda el tenant del insumo: verificar el padre alcanza y evita
    // desnormalizar `empresa_id` en la tabla de costos.
    await this.findById(insumoId, empresaId);
    const costo = this.costoInsumoRepository.create({
      insumoId,
      costoUnitario: dto.costoUnitario,
      validFrom: dto.validFrom,
      createdById,
    });
    return this.costoInsumoRepository.save(costo);
  }

  async getCostoVigente(
    insumoId: string,
    /**
     * Día de aplicación en formato `YYYY-MM-DD`.
     *
     * Se recibe como texto y no como `Date` a propósito: `new Date('2026-08-24')`
     * se parsea como medianoche **UTC**, y volver a convertirlo a fecha local
     * retrocede un día en zonas negativas. La columna `valid_from` es `date`
     * —sin hora ni huso—, así que la comparación correcta es texto contra texto.
     */
    fecha: string = hoyLocal(),
  ): Promise<CostoInsumo | null> {
    return this.costoInsumoRepository.findOne({
      where: {
        insumoId,
        validFrom: LessThanOrEqual(fecha.slice(0, 10)),
      },
      // Desempate por createdAt: con dos registros del mismo valid_from el
      // orden sin desempate lo decide el optimizador, y el costo aplicado
      // pasaba a ser no determinista.
      order: { validFrom: 'DESC', createdAt: 'DESC' },
    });
  }

  async getHistorialCostos(
    insumoId: string,
    empresaId: string,
  ): Promise<CostoInsumo[]> {
    await this.findById(insumoId, empresaId);
    return this.costoInsumoRepository.find({
      where: { insumoId },
      order: { validFrom: 'DESC' },
    });
  }
}
