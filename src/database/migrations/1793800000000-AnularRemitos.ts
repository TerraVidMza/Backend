import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Anulación de remitos aprobados por error.
 *
 * `estado` es un `varchar`, no un enum de Postgres: el valor nuevo `anulado` no
 * necesita tocar el tipo. Solo se agregan las columnas con quién, cuándo y por
 * qué se anuló. Son opcionales: los remitos existentes no cambian.
 */
export class AnularRemitos1793800000000 implements MigrationInterface {
  name = 'AnularRemitos1793800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "remitos" ADD "anulado_por" uuid`);
    await queryRunner.query(
      `ALTER TABLE "remitos" ADD "motivo_anulacion" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "remitos" ADD "fecha_anulacion" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "remitos" ADD CONSTRAINT "FK_remitos_anulado_por" FOREIGN KEY ("anulado_por") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "remitos" DROP CONSTRAINT "FK_remitos_anulado_por"`,
    );
    await queryRunner.query(
      `ALTER TABLE "remitos" DROP COLUMN "fecha_anulacion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "remitos" DROP COLUMN "motivo_anulacion"`,
    );
    await queryRunner.query(`ALTER TABLE "remitos" DROP COLUMN "anulado_por"`);
  }
}
