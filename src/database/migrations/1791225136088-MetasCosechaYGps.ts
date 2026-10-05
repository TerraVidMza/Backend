import { MigrationInterface, QueryRunner } from 'typeorm';

export class MetasCosechaYGps1791225136088 implements MigrationInterface {
  name = 'MetasCosechaYGps1791225136088';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "metas_cosecha" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "campania_id" uuid NOT NULL, "cuartel_id" uuid NOT NULL, "meta_kg" numeric(12,2) NOT NULL, "updated_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_meta_cosecha" UNIQUE ("campania_id", "cuartel_id"), CONSTRAINT "PK_75442c7b2a19d626ff0f45f138a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "pesajes_vendimia" ADD "latitud" numeric(10,7)`,
    );
    await queryRunner.query(
      `ALTER TABLE "pesajes_vendimia" ADD "longitud" numeric(10,7)`,
    );
    await queryRunner.query(
      `ALTER TABLE "registro_labor" ADD "latitud" numeric(10,7)`,
    );
    await queryRunner.query(
      `ALTER TABLE "registro_labor" ADD "longitud" numeric(10,7)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "registro_labor" DROP COLUMN "longitud"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registro_labor" DROP COLUMN "latitud"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pesajes_vendimia" DROP COLUMN "longitud"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pesajes_vendimia" DROP COLUMN "latitud"`,
    );
    await queryRunner.query(`DROP TABLE "metas_cosecha"`);
  }
}
