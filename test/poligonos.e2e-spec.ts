/**
 * Polígonos de fincas y cuarteles (HU-08, HU-09, HU-10) contra PostGIS real.
 *
 * Lo que importa acá no se puede verificar con la base simulada: que la
 * superficie se calcule sobre el elipsoide y no sobre grados, que "dentro de la
 * finca" tolere el trazo a mano pero no un cuartel que se va, y que la base
 * rechace un polígono inválido aunque alguien se saltee la API. Necesita la base
 * levantada, migrada (la migración crea la extensión) y sembrada:
 *
 *     docker compose up -d && npm run migration:run && npm run seed
 *     npm run test:e2e
 */
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { AppModule } from './../src/app.module';
import { FincasService } from './../src/modules/fincas/fincas.service';
import { CuartelesService } from './../src/modules/cuarteles/cuarteles.service';
import { CreateFincaDto } from './../src/modules/fincas/dto/create-finca.dto';
import { PoligonoGeoJson } from './../src/common/geo/poligono';
import { SUFIJO } from './fixtures';

/** Rectángulo con la esquina noroeste en (lng, lat) y lados en grados. */
const rectangulo = (
  lng: number,
  lat: number,
  dLng: number,
  dLat: number,
): PoligonoGeoJson => ({
  type: 'Polygon',
  coordinates: [
    [
      [lng, lat],
      [lng + dLng, lat],
      [lng + dLng, lat - dLat],
      [lng, lat - dLat],
      [lng, lat],
    ],
  ],
});

// ~1 km x 1,1 km a -33° de latitud: ~103 ha sobre el elipsoide.
const CONTORNO = rectangulo(-68.9, -33.0, 0.01, 0.01);

describe('Polígonos de fincas y cuarteles (integración con PostGIS)', () => {
  let modulo: TestingModule;
  let dataSource: DataSource;
  let fincas: FincasService;
  let cuarteles: CuartelesService;
  let empresaId: string;
  let usuarioId: string;
  let variedadId: string;
  let sistemaId: string;
  const fincasCreadas: string[] = [];

  beforeAll(async () => {
    modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await modulo.init();
    dataSource = modulo.get(DataSource);
    fincas = modulo.get(FincasService);
    cuarteles = modulo.get(CuartelesService);

    const [{ id: e }] = await dataSource.query<{ id: string }[]>(
      'SELECT id FROM empresas ORDER BY created_at LIMIT 1',
    );
    const [{ id: u }] = await dataSource.query<{ id: string }[]>(
      'SELECT id FROM usuarios ORDER BY created_at LIMIT 1',
    );
    const [{ id: v }] = await dataSource.query<{ id: string }[]>(
      `SELECT id FROM catalogo_item WHERE tipo = 'variedad' AND activo = true LIMIT 1`,
    );
    const [{ id: s }] = await dataSource.query<{ id: string }[]>(
      `SELECT id FROM catalogo_item WHERE tipo = 'sistema_conduccion' AND activo = true LIMIT 1`,
    );
    [empresaId, usuarioId, variedadId, sistemaId] = [e, u, v, s];
  });

  afterEach(async () => {
    if (fincasCreadas.length === 0) return;
    await dataSource.query('DELETE FROM cuarteles WHERE finca_id = ANY($1)', [
      fincasCreadas,
    ]);
    await dataSource.query('DELETE FROM fincas WHERE id = ANY($1)', [
      fincasCreadas,
    ]);
    fincasCreadas.length = 0;
  });

  afterAll(async () => {
    await modulo?.close();
  });

  const nuevaFinca = async (
    nombre: string,
    extra: Partial<CreateFincaDto> = {},
  ) => {
    const finca = await fincas.create(
      { nombre: `${nombre} ${SUFIJO}`, ...extra },
      usuarioId,
      empresaId,
    );
    fincasCreadas.push(finca.id);
    return finca;
  };

  const nuevoCuartel = (
    fincaId: string,
    nombre: string,
    poligono?: PoligonoGeoJson,
  ) =>
    cuarteles.create({
      fincaId,
      variedadId,
      sistemaConduccionId: sistemaId,
      nombre: `${nombre} ${SUFIJO}`,
      poligono,
    });

  describe('fincas', () => {
    it('deriva las hectáreas sobre el elipsoide, no sobre grados', async () => {
      const finca = await nuevaFinca('Con polígono', { poligono: CONTORNO });

      // 0,01° de longitud a -33° mide ~934 m y 0,01° de latitud ~1.106 m.
      expect(Number(finca.hectareas)).toBeGreaterThan(103);
      expect(Number(finca.hectareas)).toBeLessThan(104.5);
    });

    it('el punto del mapa queda dentro del contorno', async () => {
      const finca = await nuevaFinca('Con punto', { poligono: CONTORNO });

      const [{ dentro }] = await dataSource.query<{ dentro: boolean }[]>(
        `SELECT ST_Covers(poligono, ST_SetSRID(ST_MakePoint(longitud, latitud), 4326)) AS dentro
           FROM fincas WHERE id = $1`,
        [finca.id],
      );
      expect(dentro).toBe(true);
    });

    it('guarda el polígono en WGS 84 (4326) y lo devuelve como GeoJSON', async () => {
      const finca = await nuevaFinca('Con SRID', { poligono: CONTORNO });

      const [{ srid }] = await dataSource.query<{ srid: number }[]>(
        'SELECT ST_SRID(poligono) AS srid FROM fincas WHERE id = $1',
        [finca.id],
      );
      expect(srid).toBe(4326);
      expect(finca.poligono?.type).toBe('Polygon');
    });

    it('una finca sin polígono sigue funcionando como antes', async () => {
      const finca = await nuevaFinca('Clásica', {
        hectareas: 25.5,
        latitud: -33.1,
        longitud: -68.5,
      });

      expect(Number(finca.hectareas)).toBe(25.5);
      expect(finca.poligono ?? null).toBeNull();
    });

    it('rechaza un polígono que se cruza a sí mismo y no deja nada guardado', async () => {
      const moño: PoligonoGeoJson = {
        type: 'Polygon',
        coordinates: [
          [
            [-68.9, -33.0],
            [-68.88, -33.02],
            [-68.88, -33.0],
            [-68.9, -33.02],
            [-68.9, -33.0],
          ],
        ],
      };

      await expect(
        nuevaFinca('Moño', { poligono: moño }),
      ).rejects.toBeInstanceOf(BadRequestException);
      const [{ n }] = await dataSource.query<{ n: string }[]>(
        'SELECT count(*) AS n FROM fincas WHERE nombre = $1',
        [`Moño ${SUFIJO}`],
      );
      expect(Number(n)).toBe(0);
    });

    it('la base misma rechaza un polígono inválido, aunque se escriba por fuera de la API', async () => {
      await expect(
        dataSource.query(
          `INSERT INTO fincas (nombre, hectareas, empresa_id, created_by, poligono)
           VALUES ($1, 1, $2, $3, ST_GeomFromText('POLYGON((0 0,2 2,2 0,0 2,0 0))', 4326))`,
          [`Directo ${SUFIJO}`, empresaId, usuarioId],
        ),
      ).rejects.toThrow(/chk_fincas_poligono_valido/);
    });

    it('rechaza cambiar a mano las hectáreas de una finca con polígono', async () => {
      const finca = await nuevaFinca('Bloqueada', { poligono: CONTORNO });

      await expect(
        fincas.update(finca.id, { hectareas: 5 }, empresaId),
      ).rejects.toThrow(/Esta finca tiene polígono/);
    });

    it('con poligono: null la finca vuelve a la carga manual', async () => {
      const finca = await nuevaFinca('Liberada', { poligono: CONTORNO });

      await fincas.update(finca.id, { poligono: null }, empresaId);
      const editada = await fincas.update(
        finca.id,
        { hectareas: 50 },
        empresaId,
      );

      expect(Number(editada.hectareas)).toBe(50);
      expect(editada.poligono).toBeNull();
    });
  });

  describe('cuarteles', () => {
    it('un cuartel dentro de la finca se guarda sin advertencias', async () => {
      const finca = await nuevaFinca('Anfitriona', { poligono: CONTORNO });

      const cuartel = await nuevoCuartel(
        finca.id,
        'Adentro',
        rectangulo(-68.898, -33.002, 0.004, 0.004),
      );

      expect(cuartel.advertencias).toBeUndefined();
      expect(Number(cuartel.hectareas)).toBeGreaterThan(16);
      expect(Number(cuartel.hectareas)).toBeLessThan(17);
    });

    it('un cuartel que se sale se guarda igual, pero con advertencia', async () => {
      const finca = await nuevaFinca('Anfitriona', { poligono: CONTORNO });

      const cuartel = await nuevoCuartel(
        finca.id,
        'Afuera',
        rectangulo(-68.95, -33.05, 0.004, 0.004),
      );

      expect(cuartel.id).toBeDefined();
      expect(cuartel.advertencias?.[0]).toMatch(/se sale del contorno/);
    });

    it('informa qué porcentaje del cuartel queda afuera', async () => {
      const finca = await nuevaFinca('Anfitriona', { poligono: CONTORNO });

      // Mitad adentro, mitad afuera: el lado este de la finca es -68.89.
      const cuartel = await nuevoCuartel(
        finca.id,
        'Mitad',
        rectangulo(-68.892, -33.002, 0.004, 0.004),
      );

      expect(cuartel.advertencias?.[0]).toMatch(/aprox\. (4\d|5\d)(\.\d)? %/);
    });

    it('tolera un trazo que se pasa unos metros del borde', async () => {
      const finca = await nuevaFinca('Anfitriona', { poligono: CONTORNO });

      // Se pasa ~5 m (0,00005°) por el lado oeste: dentro de la tolerancia.
      const cuartel = await nuevoCuartel(
        finca.id,
        'Al borde',
        rectangulo(-68.90005, -33.002, 0.004, 0.004),
      );

      expect(cuartel.advertencias).toBeUndefined();
    });

    it('sin polígono en la finca, no hay con qué comparar y no advierte', async () => {
      const finca = await nuevaFinca('Sin contorno', { hectareas: 100 });

      const cuartel = await nuevoCuartel(
        finca.id,
        'Libre',
        rectangulo(-60, -30, 0.004, 0.004),
      );

      expect(cuartel.advertencias).toBeUndefined();
    });

    it('achicar el contorno de la finca avisa qué cuarteles quedan afuera', async () => {
      const finca = await nuevaFinca('Anfitriona', { poligono: CONTORNO });
      await nuevoCuartel(
        finca.id,
        'Cuartel Este',
        rectangulo(-68.894, -33.002, 0.004, 0.004),
      );

      const editada = await fincas.update(
        finca.id,
        { poligono: rectangulo(-68.9, -33.0, 0.003, 0.01) },
        empresaId,
      );

      expect(editada.advertencias?.[0]).toMatch(/Cuartel Este/);
    });

    it('rechaza cambiar a mano las hectáreas de un cuartel con polígono', async () => {
      const finca = await nuevaFinca('Anfitriona', { poligono: CONTORNO });
      const cuartel = await nuevoCuartel(
        finca.id,
        'Fijo',
        rectangulo(-68.898, -33.002, 0.004, 0.004),
      );

      await expect(
        cuarteles.update(cuartel.id, { hectareas: 3 }),
      ).rejects.toThrow(/Este cuartel tiene polígono/);
    });

    it('el detalle y el buscador devuelven el polígono del cuartel', async () => {
      const finca = await nuevaFinca('Anfitriona', { poligono: CONTORNO });
      const cuartel = await nuevoCuartel(
        finca.id,
        'Visible',
        rectangulo(-68.898, -33.002, 0.004, 0.004),
      );

      const detalle = await cuarteles.findById(cuartel.id);
      const { data } = await cuarteles.buscar(empresaId, { fincaId: finca.id });

      expect(detalle.poligono?.type).toBe('Polygon');
      expect(data[0].poligono?.type).toBe('Polygon');
    });
  });
});
