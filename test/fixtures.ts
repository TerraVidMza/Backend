/**
 * Fixtures para los tests de integración.
 *
 * Crean datos reales en la base de pruebas a través del `DataSource`, sobre lo
 * que ya dejó el seed (empresa demo, usuario Propietario, catálogos maestros).
 * Todo lo que crean queda con un sufijo único por corrida, así dos ejecuciones
 * seguidas no chocan contra los índices únicos por nombre.
 *
 * No se usa una transacción envolvente por test: los servicios abren las suyas
 * y anidarlas con savepoints haría que un error de constraint —que es
 * justamente lo que se quiere ejercer— aborte la transacción externa y falle el
 * resto del archivo por una razón que no es la del test.
 */
import { DataSource } from 'typeorm';

/** Sufijo por corrida, para no chocar con índices únicos por nombre. */
export const SUFIJO = Date.now().toString().slice(-8);

export interface Contexto {
  empresaId: string;
  usuarioId: string;
  fincaId: string;
  cuartelId: string;
  cuadrillaId: string;
}

interface FilaId {
  id: string;
}

async function unId(
  dataSource: DataSource,
  sql: string,
  parametros: unknown[] = [],
): Promise<string> {
  const filas = await dataSource.query<FilaId[]>(sql, parametros);
  if (!filas[0]?.id) {
    throw new Error(`La consulta no devolvió un id:\n${sql}`);
  }
  return filas[0].id;
}

/**
 * Arma una jerarquía completa empresa → finca → cuartel, más una cuadrilla.
 *
 * Se apoya en el seed para la empresa, el usuario y los catálogos: replicarlos
 * acá sería mantener dos versiones de la misma verdad, y si el seed cambia los
 * tests tienen que enterarse.
 */
export async function crearContexto(
  dataSource: DataSource,
  etiqueta: string,
): Promise<Contexto> {
  const nombre = (base: string): string => `${base} ${etiqueta} ${SUFIJO}`;

  const empresaId = await unId(
    dataSource,
    'SELECT id FROM empresas ORDER BY created_at LIMIT 1',
  );
  const usuarioId = await unId(
    dataSource,
    'SELECT id FROM usuarios ORDER BY created_at LIMIT 1',
  );
  const variedadId = await unId(
    dataSource,
    `SELECT id FROM catalogo_item WHERE tipo = 'variedad' AND activo = true LIMIT 1`,
  );
  const sistemaId = await unId(
    dataSource,
    `SELECT id FROM catalogo_item WHERE tipo = 'sistema_conduccion' AND activo = true LIMIT 1`,
  );

  const fincaId = await unId(
    dataSource,
    `INSERT INTO fincas (nombre, hectareas, empresa_id, created_by)
     VALUES ($1, 100, $2, $3) RETURNING id`,
    [nombre('Finca'), empresaId, usuarioId],
  );

  const cuartelId = await unId(
    dataSource,
    `INSERT INTO cuarteles (finca_id, variedad_id, sistema_conduccion_id, nombre, hectareas)
     VALUES ($1, $2, $3, $4, 10) RETURNING id`,
    [fincaId, variedadId, sistemaId, nombre('Cuartel')],
  );

  const cuadrillaId = await unId(
    dataSource,
    `INSERT INTO cuadrillas (finca_id, nombre, cantidad_integrantes)
     VALUES ($1, $2, 8) RETURNING id`,
    [fincaId, nombre('Cuadrilla')],
  );

  return { empresaId, usuarioId, fincaId, cuartelId, cuadrillaId };
}

/** Carga una tarifa con su fecha de vigencia. La tabla es append-only. */
export async function darTarifa(
  dataSource: DataSource,
  ctx: Contexto,
  tarifaPorKg: number,
  validFrom: string,
): Promise<void> {
  await dataSource.query(
    `INSERT INTO tarifa_cuadrilla (cuadrilla_id, tarifa_por_kg, valid_from, created_by)
     VALUES ($1, $2, $3, $4)`,
    [ctx.cuadrillaId, tarifaPorKg, validFrom, ctx.usuarioId],
  );
}

/**
 * Borra lo que creó `crearContexto`, en orden inverso al de las dependencias.
 *
 * El log de auditoría no se toca: es append-only por trigger, y un test que
 * intentara limpiarlo fallaría con el error correcto por el motivo equivocado.
 */
export async function limpiarContexto(
  dataSource: DataSource,
  ctx: Contexto,
): Promise<void> {
  await dataSource.query('DELETE FROM pesajes_vendimia WHERE cuartel_id = $1', [
    ctx.cuartelId,
  ]);
  await dataSource.query(
    'DELETE FROM tarifa_cuadrilla WHERE cuadrilla_id = $1',
    [ctx.cuadrillaId],
  );
  await dataSource.query('DELETE FROM cuadrillas WHERE id = $1', [
    ctx.cuadrillaId,
  ]);
  await dataSource.query('DELETE FROM cuarteles WHERE id = $1', [
    ctx.cuartelId,
  ]);
  await dataSource.query('DELETE FROM fincas WHERE id = $1', [ctx.fincaId]);
}
