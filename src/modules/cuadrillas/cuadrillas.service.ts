import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Cuadrilla } from './entities/cuadrilla.entity';
import { TarifaCuadrilla } from './entities/tarifa-cuadrilla.entity';
import { CreateCuadrillaDto } from './dto/create-cuadrilla.dto';
import { UpdateCuadrillaDto } from './dto/update-cuadrilla.dto';
import { SetTarifaDto } from './dto/set-tarifa.dto';
import { RolNombre } from '../../common/enums/rol.enum';
import { hoyLocal } from '../../common/fechas/rango-fechas';

@Injectable()
export class CuadrillasService {
  constructor(
    @InjectRepository(Cuadrilla)
    private readonly cuadrillaRepository: Repository<Cuadrilla>,
    @InjectRepository(TarifaCuadrilla)
    private readonly tarifaRepository: Repository<TarifaCuadrilla>,
  ) {}

  findByFinca(fincaId: string): Promise<Cuadrilla[]> {
    return this.cuadrillaRepository.find({
      where: { fincaId, activa: true },
      order: { nombre: 'ASC' },
    });
  }

  async findById(id: string): Promise<Cuadrilla> {
    const cuadrilla = await this.cuadrillaRepository.findOne({ where: { id } });
    if (!cuadrilla) {
      throw new NotFoundException('Cuadrilla no encontrada');
    }
    return cuadrilla;
  }

  /**
   * Alta de cuadrilla (HU-23).
   *
   * La tarifa a destajo es dinero y solo la fija el Propietario: si el
   * solicitante tiene otro rol, el campo se descarta en silencio aunque venga
   * en el body. La cuadrilla queda creada sin tarifa y el Propietario la asigna
   * después con `POST /cuadrillas/:id/tarifas`.
   */
  async create(
    dto: CreateCuadrillaDto,
    createdById: string,
    rolSolicitante: RolNombre,
  ): Promise<Cuadrilla> {
    const cuadrilla = this.cuadrillaRepository.create({
      fincaId: dto.fincaId,
      nombre: dto.nombre,
      cantidadIntegrantes: dto.cantidadIntegrantes,
      activa: true,
    });
    const guardada = await this.cuadrillaRepository.save(cuadrilla);

    const puedeFijarTarifa = rolSolicitante === RolNombre.PROPIETARIO;
    if (puedeFijarTarifa && dto.tarifaPorKgInicial !== undefined) {
      await this.setTarifa(
        guardada.id,
        {
          tarifaPorKg: dto.tarifaPorKgInicial,
          validFrom: hoyLocal(),
        },
        createdById,
      );
    }

    return guardada;
  }

  async update(id: string, dto: UpdateCuadrillaDto): Promise<Cuadrilla> {
    const cuadrilla = await this.findById(id);
    Object.assign(cuadrilla, dto);
    return this.cuadrillaRepository.save(cuadrilla);
  }

  async desactivar(id: string): Promise<Cuadrilla> {
    const cuadrilla = await this.findById(id);
    cuadrilla.activa = false;
    return this.cuadrillaRepository.save(cuadrilla);
  }

  async setTarifa(
    cuadrillaId: string,
    dto: SetTarifaDto,
    createdById: string,
  ): Promise<TarifaCuadrilla> {
    await this.findById(cuadrillaId);
    const tarifa = this.tarifaRepository.create({
      cuadrillaId,
      tarifaPorKg: dto.tarifaPorKg,
      validFrom: dto.validFrom,
      createdById,
    });
    return this.tarifaRepository.save(tarifa);
  }

  async getTarifaVigente(
    cuadrillaId: string,
    /**
     * Día de aplicación en formato `YYYY-MM-DD`.
     *
     * Se recibe como texto y no como `Date` a propósito: `new Date('2026-08-24')`
     * se parsea como medianoche **UTC**, y volver a convertirlo a fecha local
     * retrocede un día en zonas negativas. La columna `valid_from` es `date`
     * —sin hora ni huso—, así que la comparación correcta es texto contra texto.
     */
    fecha: string = hoyLocal(),
  ): Promise<TarifaCuadrilla | null> {
    return this.tarifaRepository.findOne({
      where: {
        cuadrillaId,
        validFrom: LessThanOrEqual(fecha.slice(0, 10)),
      },
      // Desempate por createdAt: con dos registros del mismo valid_from el
      // orden sin desempate lo decide el optimizador, y el costo aplicado
      // pasaba a ser no determinista.
      order: { validFrom: 'DESC', createdAt: 'DESC' },
    });
  }

  async getHistorialTarifas(cuadrillaId: string): Promise<TarifaCuadrilla[]> {
    return this.tarifaRepository.find({
      where: { cuadrillaId },
      order: { validFrom: 'DESC' },
    });
  }
}
