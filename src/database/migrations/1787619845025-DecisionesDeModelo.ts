import { MigrationInterface, QueryRunner } from 'typeorm';

export class DecisionesDeModelo1787619845025 implements MigrationInterface {
  name = 'DecisionesDeModelo1787619845025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."uq_insumos_nombre_activo"`);
    await queryRunner.query(
      `DROP INDEX "public"."uq_tipo_labor_nombre_activo"`,
    );
    await queryRunner.query(
      `CREATE TABLE "liquidaciones_bodega" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "remito_id" uuid NOT NULL, "bodega" character varying(150) NOT NULL, "kg_aceptados" numeric(10,2) NOT NULL, "precio_por_kg" numeric(12,4) NOT NULL, "descuentos" numeric(12,2) NOT NULL DEFAULT '0', "monto_neto" numeric(14,2) NOT NULL, "fecha" date NOT NULL, "numero_comprobante" character varying(50), "registrado_por" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_343d9bcc6779ae15cf86e3b95ca" UNIQUE ("remito_id"), CONSTRAINT "chk_liquidacion_precio_positivo" CHECK ("precio_por_kg" > 0), CONSTRAINT "chk_liquidacion_kg_positivos" CHECK ("kg_aceptados" > 0), CONSTRAINT "PK_e1aac773f8fb0915bf324b8441c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_liquidacion_remito" ON "liquidaciones_bodega"  ("remito_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "usuario_finca" ("usuario_id" uuid NOT NULL, "finca_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_875174209749c080b9533a67c90" PRIMARY KEY ("usuario_id", "finca_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_usuario_finca_finca" ON "usuario_finca"  ("finca_id") `,
    );
    // --- D-h: los catalogos pasan a ser por empresa.
    //
    // Se agrega la columna NULLABLE, se rellena y recien despues se marca
    // NOT NULL. Agregarla directamente como NOT NULL falla en cuanto la
    // tabla tenga una sola fila, que es el caso de cualquier instalacion en
    // uso: la migracion generada no puede saberlo, pero nosotros si.
    await queryRunner.query(
      `ALTER TABLE "catalogo_item" ADD "empresa_id" uuid`,
    );
    await queryRunner.query(`ALTER TABLE "insumos" ADD "empresa_id" uuid`);
    await queryRunner.query(`ALTER TABLE "tipo_labor" ADD "empresa_id" uuid`);

    // Backfill: los catalogos eran globales, asi que no hay forma de saber
    // a que empresa pertenecia cada fila. Con una sola empresa la respuesta
    // es obvia; con varias, la asignacion es una decision de negocio y la
    // migracion se detiene en vez de adivinar y mezclar datos entre tenants.
    const empresas = (await queryRunner.query(
      `SELECT id FROM empresas ORDER BY created_at LIMIT 2`,
    )) as Array<{ id: string }>;

    const filasHuerfanas = (await queryRunner.query(
      `SELECT (SELECT COUNT(*) FROM catalogo_item)::int
                  + (SELECT COUNT(*) FROM insumos)::int
                  + (SELECT COUNT(*) FROM tipo_labor)::int AS total`,
    )) as Array<{ total: number }>;
    const total = Number(filasHuerfanas[0]?.total ?? 0);

    if (total > 0) {
      if (empresas.length !== 1) {
        throw new Error(
          `Hay ${total} fila(s) de catalogo sin empresa y ${empresas.length} empresa(s) en la base. ` +
            `Asigna manualmente "empresa_id" en catalogo_item, insumos y tipo_labor antes de correr esta migracion (D-h).`,
        );
      }
      const empresaId = empresas[0].id;
      await queryRunner.query(
        `UPDATE "catalogo_item" SET "empresa_id" = $1 WHERE "empresa_id" IS NULL`,
        [empresaId],
      );
      await queryRunner.query(
        `UPDATE "insumos" SET "empresa_id" = $1 WHERE "empresa_id" IS NULL`,
        [empresaId],
      );
      await queryRunner.query(
        `UPDATE "tipo_labor" SET "empresa_id" = $1 WHERE "empresa_id" IS NULL`,
        [empresaId],
      );
    }

    await queryRunner.query(
      `ALTER TABLE "catalogo_item" ALTER COLUMN "empresa_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "insumos" ALTER COLUMN "empresa_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tipo_labor" ALTER COLUMN "empresa_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_catalogo_item_nombre_activo" ON "catalogo_item"  ("empresa_id", "tipo", "nombre") WHERE "activo" = true`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_insumos_nombre_activo" ON "insumos"  ("empresa_id", "nombre") WHERE "activo" = true`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_tipo_labor_nombre_activo" ON "tipo_labor"  ("empresa_id", "nombre") WHERE "activo" = true`,
    );
    await queryRunner.query(
      `ALTER TABLE "catalogo_item" ADD CONSTRAINT "FK_1c2eba5fd6de71d4f160c80201d" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "insumos" ADD CONSTRAINT "FK_a2eb137778163d81403bcbea7ec" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tipo_labor" ADD CONSTRAINT "FK_c82d6cddea9abffacc9ca97bbeb" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "liquidaciones_bodega" ADD CONSTRAINT "FK_343d9bcc6779ae15cf86e3b95ca" FOREIGN KEY ("remito_id") REFERENCES "remitos"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "liquidaciones_bodega" ADD CONSTRAINT "FK_06b21be6e20f9790f55fd540505" FOREIGN KEY ("registrado_por") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuario_finca" ADD CONSTRAINT "FK_5392331c2107f9db3a012133c13" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuario_finca" ADD CONSTRAINT "FK_423cc1b2144243bb27b5f2fd87b" FOREIGN KEY ("finca_id") REFERENCES "fincas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuario_finca" DROP CONSTRAINT "FK_423cc1b2144243bb27b5f2fd87b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuario_finca" DROP CONSTRAINT "FK_5392331c2107f9db3a012133c13"`,
    );
    await queryRunner.query(
      `ALTER TABLE "liquidaciones_bodega" DROP CONSTRAINT "FK_06b21be6e20f9790f55fd540505"`,
    );
    await queryRunner.query(
      `ALTER TABLE "liquidaciones_bodega" DROP CONSTRAINT "FK_343d9bcc6779ae15cf86e3b95ca"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tipo_labor" DROP CONSTRAINT "FK_c82d6cddea9abffacc9ca97bbeb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insumos" DROP CONSTRAINT "FK_a2eb137778163d81403bcbea7ec"`,
    );
    await queryRunner.query(
      `ALTER TABLE "catalogo_item" DROP CONSTRAINT "FK_1c2eba5fd6de71d4f160c80201d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_tipo_labor_nombre_activo"`,
    );
    await queryRunner.query(`DROP INDEX "public"."uq_insumos_nombre_activo"`);
    await queryRunner.query(
      `DROP INDEX "public"."uq_catalogo_item_nombre_activo"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tipo_labor" DROP COLUMN "empresa_id"`,
    );
    await queryRunner.query(`ALTER TABLE "insumos" DROP COLUMN "empresa_id"`);
    await queryRunner.query(
      `ALTER TABLE "catalogo_item" DROP COLUMN "empresa_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_usuario_finca_finca"`);
    await queryRunner.query(`DROP TABLE "usuario_finca"`);
    await queryRunner.query(`DROP INDEX "public"."uq_liquidacion_remito"`);
    await queryRunner.query(`DROP TABLE "liquidaciones_bodega"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_tipo_labor_nombre_activo" ON "tipo_labor" USING btree ("nombre") WHERE (activo = true)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_insumos_nombre_activo" ON "insumos" USING btree ("nombre") WHERE (activo = true)`,
    );
  }
}
