import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefreshTokens1791211439731 implements MigrationInterface {
  name = 'RefreshTokens1791211439731';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "refresh_token" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "token_hash" character(64) NOT NULL, "usuario_id" uuid NOT NULL, "familia_id" uuid NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revocado_at" TIMESTAMP WITH TIME ZONE, "reemplazado_por_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b575dd3c21fb0831013c909e7fe" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_refresh_token_hash" ON "refresh_token"  ("token_hash") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_refresh_token_expira" ON "refresh_token"  ("expires_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_refresh_token_usuario" ON "refresh_token"  ("usuario_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_refresh_token_familia" ON "refresh_token"  ("familia_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_refresh_token_familia"`);
    await queryRunner.query(`DROP INDEX "public"."idx_refresh_token_usuario"`);
    await queryRunner.query(`DROP INDEX "public"."idx_refresh_token_expira"`);
    await queryRunner.query(`DROP INDEX "public"."uq_refresh_token_hash"`);
    await queryRunner.query(`DROP TABLE "refresh_token"`);
  }
}
