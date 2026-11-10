import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Polígonos de fincas y cuarteles con PostGIS.
 *
 * La columna es opcional: las fincas y cuarteles que ya existen conservan su
 * punto (`latitud`/`longitud`) y sus hectáreas cargadas a mano, y nada se migra.
 *
 * `CREATE EXTENSION` exige un rol con permiso para crearla. Las migraciones
 * corren con las credenciales de administración (D-017), no con el rol acotado
 * de la aplicación, así que alcanza. En producción la imagen de la base tiene
 * que traer PostGIS (`postgis/postgis:16-3.4-alpine`): con `postgres:16-alpine`
 * esta migración falla antes de tocar nada.
 *
 * SRID 4326 (WGS 84, lo que usa Leaflet y el GPS). El CHECK de validez evita
 * guardar polígonos que se cruzan a sí mismos, con independencia de quién
 * escriba en la tabla.
 *
 * `down` no borra la extensión: puede estar en uso por otra cosa.
 */
export class PoligonosPostgis1793752681903 implements MigrationInterface {
  name = 'PoligonosPostgis1793752681903';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);

    await queryRunner.query(
      `ALTER TABLE "fincas" ADD "poligono" geometry(Polygon,4326)`,
    );
    await queryRunner.query(
      `ALTER TABLE "cuarteles" ADD "poligono" geometry(Polygon,4326)`,
    );

    await queryRunner.query(
      `ALTER TABLE "fincas" ADD CONSTRAINT "chk_fincas_poligono_valido" CHECK ("poligono" IS NULL OR ST_IsValid("poligono"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "cuarteles" ADD CONSTRAINT "chk_cuarteles_poligono_valido" CHECK ("poligono" IS NULL OR ST_IsValid("poligono"))`,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_fincas_poligono" ON "fincas" USING GIST ("poligono")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_cuarteles_poligono" ON "cuarteles" USING GIST ("poligono")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_cuarteles_poligono"`);
    await queryRunner.query(`DROP INDEX "idx_fincas_poligono"`);
    await queryRunner.query(
      `ALTER TABLE "cuarteles" DROP CONSTRAINT "chk_cuarteles_poligono_valido"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincas" DROP CONSTRAINT "chk_fincas_poligono_valido"`,
    );
    await queryRunner.query(`ALTER TABLE "cuarteles" DROP COLUMN "poligono"`);
    await queryRunner.query(`ALTER TABLE "fincas" DROP COLUMN "poligono"`);
  }
}
