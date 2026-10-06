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
import * as bcrypt from 'bcrypt';

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

/**
 * Igual que `crearContexto`, pero colgando de una **empresa nueva**.
 *
 * Es lo que hace falta para probar el aislamiento multi-tenant: sin un recurso
 * que pertenezca de verdad a otra empresa, un test de aislamiento solo verifica
 * que un uuid inexistente da 404, que es otra cosa.
 */
export async function crearContextoDeOtraEmpresa(
  dataSource: DataSource,
  etiqueta: string,
): Promise<Contexto> {
  const nombre = (base: string): string => `${base} ${etiqueta} ${SUFIJO}`;

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

  // El CUIT es único: se deriva del sufijo de la corrida.
  const empresaId = await unId(
    dataSource,
    `INSERT INTO empresas (nombre, cuit) VALUES ($1, $2) RETURNING id`,
    [nombre('Empresa ajena'), `30${SUFIJO}1`],
  );

  const fincaId = await unId(
    dataSource,
    `INSERT INTO fincas (nombre, hectareas, empresa_id, created_by)
     VALUES ($1, 50, $2, $3) RETURNING id`,
    [nombre('Finca ajena'), empresaId, usuarioId],
  );

  const cuartelId = await unId(
    dataSource,
    `INSERT INTO cuarteles (finca_id, variedad_id, sistema_conduccion_id, nombre, hectareas)
     VALUES ($1, $2, $3, $4, 5) RETURNING id`,
    [fincaId, variedadId, sistemaId, nombre('Cuartel ajeno')],
  );

  const cuadrillaId = await unId(
    dataSource,
    `INSERT INTO cuadrillas (finca_id, nombre, cantidad_integrantes)
     VALUES ($1, $2, 4) RETURNING id`,
    [fincaId, nombre('Cuadrilla ajena')],
  );

  return { empresaId, usuarioId, fincaId, cuartelId, cuadrillaId };
}

/** Contraseña de los usuarios que crea `crearUsuario`. Cumple la política. */
export const PASSWORD_DE_PRUEBA = 'Terravid123!';

export interface UsuarioDePrueba {
  id: string;
  email: string;
  password: string;
}

/**
 * Crea un usuario propio para el archivo de test que lo pida.
 *
 * Deliberadamente **no** se reutiliza el usuario del seed: los tests de
 * autenticación lo bloquean a propósito y le cambian la contraseña, y Jest
 * corre los archivos en paralelo. Compartirlo haría que un test de login
 * hiciera fallar a otro archivo por una razón que no tiene nada que ver con lo
 * que ese archivo prueba.
 */
export async function crearUsuario(
  dataSource: DataSource,
  etiqueta: string,
  rol = 'Propietario',
): Promise<UsuarioDePrueba> {
  const empresaId = await unId(
    dataSource,
    'SELECT id FROM empresas ORDER BY created_at LIMIT 1',
  );
  const rolId = await unId(
    dataSource,
    'SELECT id FROM roles WHERE nombre_rol = $1',
    [rol],
  );

  // Se hashea con el mismo módulo que usa la aplicación: un hash escrito a mano
  // probaría que bcrypt compara, no que la aplicación guarda lo que cree.
  const hash = await bcrypt.hash(PASSWORD_DE_PRUEBA, 10);

  const email = `prueba-${etiqueta}-${SUFIJO}@terravid.test`;
  const id = await unId(
    dataSource,
    `INSERT INTO usuarios (nombre, email, password_hash, empresa_id, rol_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [`Usuario ${etiqueta}`, email, hash, empresaId, rolId],
  );

  return { id, email, password: PASSWORD_DE_PRUEBA };
}

/**
 * Limpia el usuario de prueba, o lo desactiva si ya no se puede borrar.
 *
 * **Un usuario que alguna vez actuó no se puede eliminar**, y eso no es una
 * limitación del fixture: `log_auditoria` referencia al actor y es append-only
 * por trigger (HU-07), así que borrar la fila de `usuarios` viola la foreign
 * key y no hay forma de sacar la entrada del log —que es exactamente el punto
 * de que el log sea inmutable—. Un solo login deja rastro, con lo cual casi
 * todos los usuarios de este archivo caen en ese caso.
 *
 * La alternativa sería que los tests no auditaran, y eso los volvería inútiles:
 * auditar es parte de lo que hacen los caminos que se están probando.
 */
export async function limpiarUsuario(
  dataSource: DataSource,
  usuario: UsuarioDePrueba,
): Promise<void> {
  await dataSource.query(
    'DELETE FROM token_recuperacion WHERE usuario_id = $1',
    [usuario.id],
  );
  await dataSource.query('DELETE FROM token_revocado WHERE usuario_id = $1', [
    usuario.id,
  ]);
  await dataSource.query('DELETE FROM refresh_token WHERE usuario_id = $1', [
    usuario.id,
  ]);

  const rastro = await dataSource.query<{ n: number }[]>(
    'SELECT count(*)::int AS n FROM log_auditoria WHERE actor_id = $1',
    [usuario.id],
  );

  if (rastro[0].n === 0) {
    await dataSource.query('DELETE FROM usuarios WHERE id = $1', [usuario.id]);
    return;
  }

  // Queda desactivado y con el email liberado, para que no aparezca como una
  // cuenta viva ni bloquee el indice unico en una corrida futura.
  await dataSource.query(
    `UPDATE usuarios
        SET activo = false,
            email = $2,
            intentos_fallidos = 0,
            bloqueado_hasta = NULL
      WHERE id = $1`,
    [usuario.id, `baja-${usuario.id}@terravid.test`],
  );
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
  // Las liquidaciones cuelgan del remito, y los pesajes referencian el remito:
  // el orden importa o salta la foreign key.
  await dataSource.query(
    `DELETE FROM liquidaciones_bodega WHERE remito_id IN
       (SELECT id FROM remitos WHERE cuartel_id = $1)`,
    [ctx.cuartelId],
  );
  await dataSource.query('DELETE FROM pesajes_vendimia WHERE cuartel_id = $1', [
    ctx.cuartelId,
  ]);
  await dataSource.query('DELETE FROM remitos WHERE cuartel_id = $1', [
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
  // Solo si la empresa la creó el fixture: la del seed la comparten todos los
  // tests y borrarla se llevaría puesto el resto de la corrida.
  await dataSource.query(
    `DELETE FROM empresas WHERE id = $1 AND cuit LIKE $2`,
    [ctx.empresaId, `30${SUFIJO}%`],
  );
}
