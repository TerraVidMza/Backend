import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Anulación de labores.
 *
 * `estado_sync` es un `varchar`: el valor nuevo `anulado` no toca el tipo. Solo
 * se agregan quién, cuándo y por qué se anuló. Son opcionales: las labores
 * existentes no cambian.
 */
export class AnularLabores1793810000000 implements MigrationInterface {
  name = 'AnularLabores1793810000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "registro_labor" ADD "anulado_por" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "registro_labor" ADD "motivo_anulacion" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "registro_labor" ADD "fecha_anulacion" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "registro_labor" DROP COLUMN "fecha_anulacion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registro_labor" DROP COLUMN "motivo_anulacion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registro_labor" DROP COLUMN "anulado_por"`,
    );
  }
}
