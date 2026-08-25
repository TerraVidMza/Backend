import { MigrationInterface, QueryRunner } from 'typeorm';

export class CriteriosPorBloque1787617650688 implements MigrationInterface {
  name = 'CriteriosPorBloque1787617650688';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "token_revocado" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "jti" uuid NOT NULL, "usuario_id" uuid NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_a06e23143b161e8a5a1da5e5c31" UNIQUE ("jti"), CONSTRAINT "PK_31f2fb43e5d395a7ecf1c192d2b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_token_revocado_jti" ON "token_revocado"  ("jti") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_token_revocado_expira" ON "token_revocado"  ("expires_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "lecturas_anomalas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sensor_id" uuid NOT NULL, "valor" numeric(12,4) NOT NULL, "unidad" character varying(20) NOT NULL, "sensor_timestamp" TIMESTAMP WITH TIME ZONE NOT NULL, "motivo" text NOT NULL, "received_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bc74669c79d8c504a8831bffec3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_lecturas_anomalas_sensor" ON "lecturas_anomalas"  ("sensor_id", "sensor_timestamp") `,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "debe_cambiar_password" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "cuarteles" ADD "latitud" numeric(10,7)`,
    );
    await queryRunner.query(
      `ALTER TABLE "cuarteles" ADD "longitud" numeric(10,7)`,
    );
    await queryRunner.query(
      `ALTER TABLE "pesajes_vendimia" ADD "created_at_local" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "pesajes_vendimia" ADD "inconsistencia_catalogo" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "registro_labor" ADD "created_at_local" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "registro_labor" ADD "inconsistencia_catalogo" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "insumos" DROP CONSTRAINT "UQ_0d28ae68a8f742beb176aa51ae0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tipo_labor" DROP CONSTRAINT "UQ_59c2d79229a4d6744434d4cc5ee"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_cuadrillas_nombre_activa" ON "cuadrillas"  ("finca_id", "nombre") WHERE "activa" = true`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_insumos_nombre_activo" ON "insumos"  ("nombre") WHERE "activo" = true`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_tipo_labor_nombre_activo" ON "tipo_labor"  ("nombre") WHERE "activo" = true`,
    );
    await queryRunner.query(
      `ALTER TABLE "lecturas_anomalas" ADD CONSTRAINT "FK_062d78dd664baf531a27518d24d" FOREIGN KEY ("sensor_id") REFERENCES "sensores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lecturas_anomalas" DROP CONSTRAINT "FK_062d78dd664baf531a27518d24d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_tipo_labor_nombre_activo"`,
    );
    await queryRunner.query(`DROP INDEX "public"."uq_insumos_nombre_activo"`);
    await queryRunner.query(
      `DROP INDEX "public"."uq_cuadrillas_nombre_activa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tipo_labor" ADD CONSTRAINT "UQ_59c2d79229a4d6744434d4cc5ee" UNIQUE ("nombre")`,
    );
    await queryRunner.query(
      `ALTER TABLE "insumos" ADD CONSTRAINT "UQ_0d28ae68a8f742beb176aa51ae0" UNIQUE ("nombre")`,
    );
    await queryRunner.query(
      `ALTER TABLE "registro_labor" DROP COLUMN "inconsistencia_catalogo"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registro_labor" DROP COLUMN "created_at_local"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pesajes_vendimia" DROP COLUMN "inconsistencia_catalogo"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pesajes_vendimia" DROP COLUMN "created_at_local"`,
    );
    await queryRunner.query(`ALTER TABLE "cuarteles" DROP COLUMN "longitud"`);
    await queryRunner.query(`ALTER TABLE "cuarteles" DROP COLUMN "latitud"`);
    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP COLUMN "debe_cambiar_password"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_lecturas_anomalas_sensor"`,
    );
    await queryRunner.query(`DROP TABLE "lecturas_anomalas"`);
    await queryRunner.query(`DROP INDEX "public"."idx_token_revocado_expira"`);
    await queryRunner.query(`DROP INDEX "public"."idx_token_revocado_jti"`);
    await queryRunner.query(`DROP TABLE "token_revocado"`);
  }
}
