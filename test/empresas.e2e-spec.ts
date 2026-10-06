/**
 * Alta y administración de empresas por el Administrador de plataforma
 * (D-025), contra PostgreSQL real.
 *
 * Lo que importa verificar: que una empresa nueva nace usable (con su
 * Propietario y sus catálogos), que el Administrador nunca conoce la
 * contraseña del Propietario, y que desactivar una empresa corta a sus
 * usuarios.
 *
 *     docker compose up -d && npm run migration:run && npm run seed
 *     npm run test:e2e
 */
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AppModule } from './../src/app.module';
import { AuthService } from './../src/modules/auth/auth.service';
import { EmpresasService } from './../src/modules/empresas/empresas.service';
import { SUFIJO } from './fixtures';

describe('Empresas (integración, D-025)', () => {
  let modulo: TestingModule;
  let dataSource: DataSource;
  let empresas: EmpresasService;
  let auth: AuthService;
  let adminId: string;
  const creadas: string[] = [];
  let contador = 0;

  /** CUIT único por corrida y por test. */
  const cuit = () =>
    `30-${(SUFIJO + String(++contador).padStart(2, '0')).slice(-8)}-${contador % 10}`;

  beforeAll(async () => {
    modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await modulo.init();
    dataSource = modulo.get(DataSource);
    empresas = modulo.get(EmpresasService);
    auth = modulo.get(AuthService);
    const filas = await dataSource.query<{ id: string }[]>(
      `SELECT u.id FROM usuarios u JOIN roles r ON r.id = u.rol_id
        WHERE r.nombre_rol = 'Administrador' LIMIT 1`,
    );
    adminId = filas[0].id;
  });

  afterAll(async () => {
    // Los usuarios con rastro en el log de auditoría (inmutable) no se pueden
    // borrar: quedan desactivados, igual que en `limpiarUsuario`.
    for (const id of creadas) {
      await dataSource.query(
        `UPDATE usuarios SET activo = false, email = 'baja-' || id || '@terravid.test' WHERE empresa_id = $1`,
        [id],
      );
      await dataSource.query(
        'UPDATE empresas SET activa = false WHERE id = $1',
        [id],
      );
    }
    await modulo?.close();
  });

  const crear = async (
    email = `prop-${SUFIJO}-${contador + 1}@terravid.test`,
  ) => {
    const empresa = await empresas.crear(
      {
        nombre: `Bodega ${SUFIJO}-${contador + 1}`,
        cuit: cuit(),
        propietario: { nombre: 'Dueña Nueva', email },
      },
      adminId,
    );
    creadas.push(empresa.id);
    return empresa;
  };

  it('crea la empresa con su Propietario, contraseña temporal y catálogos', async () => {
    const empresa = await crear();

    const [propietario] = await dataSource.query<
      { rol: string; debe_cambiar_password: boolean; empresa_id: string }[]
    >(
      `SELECT r.nombre_rol AS rol, u.debe_cambiar_password, u.empresa_id
         FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.id = $1`,
      [empresa.propietario.id],
    );
    expect(propietario).toEqual({
      rol: 'Propietario',
      debe_cambiar_password: true,
      empresa_id: empresa.id,
    });

    const [{ n }] = await dataSource.query<{ n: number }[]>(
      'SELECT count(*)::int AS n FROM catalogo_item WHERE empresa_id = $1',
      [empresa.id],
    );
    expect(n).toBeGreaterThan(0);
  });

  it('el listado incluye la empresa nueva y nunca la de plataforma', async () => {
    const empresa = await crear();
    const lista = await empresas.listar();

    expect(lista.find((e) => e.id === empresa.id)).toMatchObject({
      usuariosActivos: 1,
      activa: true,
    });
    const plataforma = await dataSource.query<{ id: string }[]>(
      'SELECT id FROM empresas WHERE es_plataforma',
    );
    expect(lista.map((e) => e.id)).not.toContain(plataforma[0].id);
  });

  it('rechaza un CUIT repetido sin dejar nada a medias', async () => {
    const empresa = await crear();
    const antes = await empresas.listar();

    await expect(
      empresas.crear(
        {
          nombre: 'Copia',
          cuit: empresa.cuit,
          propietario: {
            nombre: 'Otro',
            email: `otro-${SUFIJO}@terravid.test`,
          },
        },
        adminId,
      ),
    ).rejects.toThrow(/CUIT/);
    expect(await empresas.listar()).toHaveLength(antes.length);
  });

  it('rechaza un email de Propietario que ya existe', async () => {
    const empresa = await crear();
    await expect(
      empresas.crear(
        {
          nombre: 'Otra',
          cuit: cuit(),
          propietario: { nombre: 'Repetido', email: empresa.propietario.email },
        },
        adminId,
      ),
    ).rejects.toThrow(/email/);
  });

  it('desactivar la empresa corta el login de sus usuarios; activarla lo devuelve', async () => {
    const empresa = await crear();
    const password = 'Clave1234!';
    // El Propietario entra con la contraseña temporal del mail, que el test no
    // conoce: se le fija una conocida.
    await dataSource.query(
      'UPDATE usuarios SET password_hash = $2, debe_cambiar_password = false WHERE id = $1',
      [empresa.propietario.id, await bcrypt.hash(password, 10)],
    );

    await expect(
      auth.login({ email: empresa.propietario.email, password }),
    ).resolves.toBeDefined();

    await empresas.setActiva(empresa.id, false);
    await expect(
      auth.login({ email: empresa.propietario.email, password }),
    ).rejects.toThrow(/empresa está desactivada/);

    await empresas.setActiva(empresa.id, true);
    await expect(
      auth.login({ email: empresa.propietario.email, password }),
    ).resolves.toBeDefined();
  });

  it('la empresa de plataforma no se puede editar por la API', async () => {
    const [plataforma] = await dataSource.query<{ id: string }[]>(
      'SELECT id FROM empresas WHERE es_plataforma',
    );
    await expect(empresas.setActiva(plataforma.id, false)).rejects.toThrow(
      'Empresa no encontrada',
    );
  });
});
