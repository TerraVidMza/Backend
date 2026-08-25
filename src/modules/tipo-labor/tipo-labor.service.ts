import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { TipoLabor } from './entities/tipo-labor.entity';
import { CostoLabor } from './entities/costo-labor.entity';
import { CreateTipoLaborDto } from './dto/create-tipo-labor.dto';
import { UpdateTipoLaborDto } from './dto/update-tipo-labor.dto';
import { SetCostoLaborDto } from './dto/set-costo-labor.dto';
import { hoyLocal } from '../../common/fechas/rango-fechas';

@Injectable()
export class TipoLaborService {
  constructor(
    @InjectRepository(TipoLabor)
    private readonly tipoLaborRepository: Repository<TipoLabor>,
    @InjectRepository(CostoLabor)
    private readonly costoLaborRepository: Repository<CostoLabor>,
  ) {}

  findAll(empresaId: string, soloActivos = true): Promise<TipoLabor[]> {
    return this.tipoLaborRepository.find({
      where: soloActivos ? { empresaId, activo: true } : { empresaId },
      order: { nombre: 'ASC' },
    });
  }

  /**
   * `empresaId` acota al tenant: el catalogo es por empresa (D-h). Devuelve 404
   * para un tipo de labor de otra empresa, no 403.
   */
  async findById(id: string, empresaId: string): Promise<TipoLabor> {
    const tipoLabor = await this.tipoLaborRepository.findOne({
      where: { id, empresaId },
    });
    if (!tipoLabor) {
      throw new NotFoundException('Tipo de labor no encontrado');
    }
    return tipoLabor;
  }

  async create(
    dto: CreateTipoLaborDto,
    createdById: string,
    empresaId: string,
  ): Promise<TipoLabor> {
    const tipoLabor = this.tipoLaborRepository.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? null,
      unidadMedida: dto.unidadMedida,
      empresaId,
      activo: true,
    });
    const guardado = await this.tipoLaborRepository.save(tipoLabor);

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
    dto: UpdateTipoLaborDto,
    empresaId: string,
  ): Promise<TipoLabor> {
    const tipoLabor = await this.findById(id, empresaId);
    Object.assign(tipoLabor, dto);
    return this.tipoLaborRepository.save(tipoLabor);
  }

  async desactivar(id: string, empresaId: string): Promise<TipoLabor> {
    const tipoLabor = await this.findById(id, empresaId);
    tipoLabor.activo = false;
    return this.tipoLaborRepository.save(tipoLabor);
  }

  async setCosto(
    tipoLaborId: string,
    dto: SetCostoLaborDto,
    createdById: string,
    empresaId: string,
  ): Promise<CostoLabor> {
    // El costo hereda el tenant del tipo de labor: verificar el padre alcanza y
    // evita desnormalizar `empresa_id` en la tabla de costos.
    await this.findById(tipoLaborId, empresaId);
    const costo = this.costoLaborRepository.create({
      tipoLaborId,
      costoUnitario: dto.costoUnitario,
      validFrom: dto.validFrom,
      createdById,
    });
    return this.costoLaborRepository.save(costo);
  }

  async getCostoVigente(
    tipoLaborId: string,
    /**
     * Día de aplicación en formato `YYYY-MM-DD`.
     *
     * Se recibe como texto y no como `Date` a propósito: `new Date('2026-08-24')`
     * se parsea como medianoche **UTC**, y volver a convertirlo a fecha local
     * retrocede un día en zonas negativas. La columna `valid_from` es `date`
     * —sin hora ni huso—, así que la comparación correcta es texto contra texto.
     */
    fecha: string = hoyLocal(),
  ): Promise<CostoLabor | null> {
    return this.costoLaborRepository.findOne({
      where: {
        tipoLaborId,
        validFrom: LessThanOrEqual(fecha.slice(0, 10)),
      },
      // Desempate por createdAt: con dos registros del mismo valid_from el
      // orden sin desempate lo decide el optimizador, y el costo aplicado
      // pasaba a ser no determinista.
      order: { validFrom: 'DESC', createdAt: 'DESC' },
    });
  }

  async getHistorialCostos(
    tipoLaborId: string,
    empresaId: string,
  ): Promise<CostoLabor[]> {
    await this.findById(tipoLaborId, empresaId);
    return this.costoLaborRepository.find({
      where: { tipoLaborId },
      order: { validFrom: 'DESC' },
    });
  }
}
