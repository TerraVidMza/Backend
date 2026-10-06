import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmpresasYAdministrador1791213474884 implements MigrationInterface {
  name = 'EmpresasYAdministrador1791213474884';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "empresas" ADD "es_plataforma" boolean NOT NULL DEFAULT false`,
    );
    // D-025: el rol de plataforma. Va en la migración y no solo en el seed
    // porque una instancia ya sembrada no vuelve a correr el seed.
    await queryRunner.query(
      `INSERT INTO "roles" ("nombre_rol") VALUES ('Administrador') ON CONFLICT ("nombre_rol") DO NOTHING`,
    );
    // A lo sumo una empresa de plataforma.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_empresas_plataforma" ON "empresas" ("es_plataforma") WHERE "es_plataforma"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."uq_empresas_plataforma"`);
    await queryRunner.query(
      `ALTER TABLE "empresas" DROP COLUMN "es_plataforma"`,
    );
    // El rol no se borra: puede haber usuarios que lo referencian.
  }
}
