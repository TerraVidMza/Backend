import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MetaCosecha } from './entities/meta-cosecha.entity';
import { CampaniasService } from '../campanias/campanias.service';

export interface AvanceCuartel {
  cuartelId: string;
  cuartelNombre: string;
  fincaId: string;
  fincaNombre: string;
  metaKg: number | null;
  kgCosechados: number;
}

export interface AvanceCosecha {
  campania: {
    id: string;
    nombre: string;
    fechaDesde: string;
    fechaHasta: string;
  } | null;
  /** Suma de las metas cargadas; null si ningún cuartel tiene meta. */
  metaKg: number | null;
  kgCosechados: number;
  cuarteles: AvanceCuartel[];
}

/** Metas de cosecha por cuartel y campaña, y el avance contra ellas (D-027). */
@Injectable()
export class MetasCosechaService {
  constructor(
    @InjectRepository(MetaCosecha)
    private readonly repo: Repository<MetaCosecha>,
    private readonly campanias: CampaniasService,
  ) {}

  /**
   * Avance de la campaña en curso: por cuartel activo, la meta y los kilos ya
   * pesados dentro del rango de la campaña. Sin campaña en curso, vacío.
   */
  async avanceActual(
    empresaId: string,
    fincaId?: string,
  ): Promise<AvanceCosecha> {
    const campania = await this.campanias.getActual(empresaId);
    if (!campania) {
      return { campania: null, metaKg: null, kgCosechados: 0, cuarteles: [] };
    }
    return this.avance(campania, empresaId, fincaId);
  }

  async avancePorCampania(
    campaniaId: string,
    empresaId: string,
    fincaId?: string,
  ): Promise<AvanceCosecha> {
    const campania = await this.campanias.findById(campaniaId, empresaId);
    return this.avance(campania, empresaId, fincaId);
  }

  private async avance(
    campania: {
      id: string;
      nombre: string;
      fechaDesde: string;
      fechaHasta: string;
    },
    empresaId: string,
    fincaId?: string,
  ): Promise<AvanceCosecha> {
    const filas = await this.repo.query<
      Array<{
        cuartelId: string;
        cuartelNombre: string;
        fincaId: string;
        fincaNombre: string;
        metaKg: string | null;
        kgCosechados: string;
      }>
    >(
      `SELECT c.id AS "cuartelId", c.nombre AS "cuartelNombre",
              f.id AS "fincaId", f.nombre AS "fincaNombre",
              m.meta_kg AS "metaKg",
              COALESCE((SELECT SUM(p.kg_totales) FROM pesajes_vendimia p
                         WHERE p.cuartel_id = c.id
                           AND p.fecha BETWEEN $2 AND $3), 0) AS "kgCosechados"
         FROM cuarteles c
         JOIN fincas f ON f.id = c.finca_id
         LEFT JOIN metas_cosecha m ON m.cuartel_id = c.id AND m.campania_id = $4
        WHERE f.empresa_id = $1 AND c.activo
          AND ($5::uuid IS NULL OR f.id = $5)
        ORDER BY f.nombre, c.nombre`,
      [
        empresaId,
        campania.fechaDesde,
        campania.fechaHasta,
        campania.id,
        fincaId ?? null,
      ],
    );

    const cuarteles: AvanceCuartel[] = filas.map((f) => ({
      ...f,
      metaKg: f.metaKg === null ? null : Number(f.metaKg),
      kgCosechados: Number(f.kgCosechados),
    }));
    const conMeta = cuarteles.filter((c) => c.metaKg !== null);

    return {
      campania: {
        id: campania.id,
        nombre: campania.nombre,
        fechaDesde: campania.fechaDesde,
        fechaHasta: campania.fechaHasta,
      },
      metaKg: conMeta.length
        ? conMeta.reduce((s, c) => s + (c.metaKg ?? 0), 0)
        : null,
      kgCosechados: cuarteles.reduce((s, c) => s + c.kgCosechados, 0),
      cuarteles,
    };
  }

  /** Fija o borra (0) la meta de un cuartel en una campaña. */
  async fijar(
    campaniaId: string,
    cuartelId: string,
    metaKg: number,
    usuarioId: string,
    empresaId: string,
  ): Promise<{ cuartelId: string; metaKg: number | null }> {
    // 404 si la campaña no es de la empresa.
    await this.campanias.findById(campaniaId, empresaId);
    if (metaKg === 0) {
      await this.repo.delete({ campaniaId, cuartelId });
      return { cuartelId, metaKg: null };
    }
    await this.repo.upsert(
      { campaniaId, cuartelId, metaKg, updatedById: usuarioId },
      ['campaniaId', 'cuartelId'],
    );
    return { cuartelId, metaKg };
  }
}
