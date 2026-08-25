import { MigrationInterface, QueryRunner } from 'typeorm';

export class CampaniasRecomendacionesYPush1787624016066 implements MigrationInterface {
  name = 'CampaniasRecomendacionesYPush1787624016066';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "campanias" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "empresa_id" uuid NOT NULL, "nombre" character varying(50) NOT NULL, "fecha_desde" date NOT NULL, "fecha_hasta" date NOT NULL, "cerrada" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), CONSTRAINT "chk_campania_rango" CHECK ("fecha_hasta" > "fecha_desde"), CONSTRAINT "PK_1f5e014dc8cb6c3eb7eeb3cb552" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_campanias_empresa_rango" ON "campanias"  ("empresa_id", "fecha_desde", "fecha_hasta") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_campanias_nombre" ON "campanias"  ("empresa_id", "nombre") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."recomendaciones_estado_enum" AS ENUM('activa', 'aplicada', 'descartada')`,
    );
    await queryRunner.query(
      `CREATE TABLE "recomendaciones" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "cuartel_id" uuid NOT NULL, "regla_id" character varying(60) NOT NULL, "variable" character varying(40) NOT NULL, "patron_detectado" text NOT NULL, "accion_sugerida" text NOT NULL, "severidad" character varying(10) NOT NULL, "evidencia" jsonb, "estado" "public"."recomendaciones_estado_enum" NOT NULL DEFAULT 'activa', "nota" character varying(300), "resuelta_por" uuid, "timestamp_estado" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8641e57715057b969f02d7d2042" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_recomendaciones_cuartel_estado" ON "recomendaciones"  ("cuartel_id", "estado") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_recomendacion_activa" ON "recomendaciones"  ("cuartel_id", "regla_id") WHERE "estado" = 'activa'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."device_tokens_plataforma_enum" AS ENUM('android', 'ios', 'web')`,
    );
    await queryRunner.query(
      `CREATE TABLE "device_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "usuario_id" uuid NOT NULL, "token" character varying(512) NOT NULL, "plataforma" "public"."device_tokens_plataforma_enum" NOT NULL, "activo" boolean NOT NULL DEFAULT true, "ultimo_uso" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), CONSTRAINT "PK_84700be257607cfb1f9dc2e52c3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_device_tokens_usuario" ON "device_tokens"  ("usuario_id", "activo") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_device_token" ON "device_tokens"  ("token") `,
    );
    await queryRunner.query(
      `ALTER TABLE "campanias" ADD CONSTRAINT "FK_aaa185d622351eb5ae1c70d1c61" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "recomendaciones" ADD CONSTRAINT "FK_71214d33f0a53b3080149f7cd55" FOREIGN KEY ("cuartel_id") REFERENCES "cuarteles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "recomendaciones" ADD CONSTRAINT "FK_4e61a396cab66da62c4afdcd656" FOREIGN KEY ("resuelta_por") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_tokens" ADD CONSTRAINT "FK_3f5b537c3a0dae8e1f6b52c2d35" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // --- D-014: las campañas de una empresa no pueden solaparse.
    //
    // El servicio ya lo valida, pero dos altas concurrentes pasan las dos
    // validaciones antes de que cualquiera inserte. Sin esta restricción
    // "la campaña actual" quedaría ambigua, que es justo el problema que la
    // entidad viene a resolver.
    //
    // `btree_gist` es lo que permite mezclar la igualdad de `empresa_id`
    // con el solapamiento del rango en un mismo EXCLUDE.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);
    await queryRunner.query(`
            ALTER TABLE "campanias"
              ADD CONSTRAINT "excl_campanias_sin_solape"
              EXCLUDE USING gist (
                "empresa_id" WITH =,
                daterange("fecha_desde", "fecha_hasta", '[]') WITH &&
              )
        `);

    // --- HU-07: el log de auditoría es append-only a nivel de base.
    //
    // El criterio pide que la tabla tenga restricciones que impidan
    // modificar o eliminar registros. Un GRANT/REVOKE no alcanza mientras
    // la aplicación se conecte con el superusuario `postgres`, porque los
    // superusuarios ignoran los privilegios: un trigger, en cambio, se
    // aplica a todos.
    //
    // Sigue siendo evitable a propósito (`ALTER TABLE ... DISABLE TRIGGER`,
    // que exige ser dueño de la tabla). El objetivo no es frenar a un
    // atacante con acceso de superusuario —eso ya está perdido— sino que
    // ningún camino de la aplicación, ni un `UPDATE` manual distraído,
    // pueda alterar la evidencia.
    await queryRunner.query(`
            CREATE OR REPLACE FUNCTION log_auditoria_solo_insercion()
            RETURNS trigger AS $$
            BEGIN
              RAISE EXCEPTION
                'El log de auditoría es de solo inserción (HU-07): % no está permitido.', TG_OP
                USING ERRCODE = 'restrict_violation';
            END;
            $$ LANGUAGE plpgsql
        `);
    await queryRunner.query(`
            CREATE TRIGGER trg_log_auditoria_inmutable
              BEFORE UPDATE OR DELETE ON "log_auditoria"
              FOR EACH ROW EXECUTE FUNCTION log_auditoria_solo_insercion()
        `);
    // TRUNCATE no dispara triggers de fila: necesita el suyo, a nivel de
    // sentencia. Sin esto, vaciar la tabla entera seguiría siendo posible.
    await queryRunner.query(`
            CREATE TRIGGER trg_log_auditoria_no_truncate
              BEFORE TRUNCATE ON "log_auditoria"
              FOR EACH STATEMENT EXECUTE FUNCTION log_auditoria_solo_insercion()
        `);

    // Defensa en profundidad para cuando la aplicación deje de conectarse
    // como superusuario: sin estos privilegios, un rol común tampoco puede
    // intentarlo.
    await queryRunner.query(
      `REVOKE UPDATE, DELETE, TRUNCATE ON "log_auditoria" FROM PUBLIC`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_log_auditoria_no_truncate ON "log_auditoria"`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_log_auditoria_inmutable ON "log_auditoria"`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS log_auditoria_solo_insercion()`,
    );
    await queryRunner.query(
      `ALTER TABLE "campanias" DROP CONSTRAINT IF EXISTS "excl_campanias_sin_solape"`,
    );
    // `btree_gist` no se elimina: puede haberla instalado otra cosa, y
    // dejarla no cuesta nada.
    await queryRunner.query(
      `ALTER TABLE "device_tokens" DROP CONSTRAINT "FK_3f5b537c3a0dae8e1f6b52c2d35"`,
    );
    await queryRunner.query(
      `ALTER TABLE "recomendaciones" DROP CONSTRAINT "FK_4e61a396cab66da62c4afdcd656"`,
    );
    await queryRunner.query(
      `ALTER TABLE "recomendaciones" DROP CONSTRAINT "FK_71214d33f0a53b3080149f7cd55"`,
    );
    await queryRunner.query(
      `ALTER TABLE "campanias" DROP CONSTRAINT "FK_aaa185d622351eb5ae1c70d1c61"`,
    );
    await queryRunner.query(`DROP INDEX "public"."uq_device_token"`);
    await queryRunner.query(`DROP INDEX "public"."idx_device_tokens_usuario"`);
    await queryRunner.query(`DROP TABLE "device_tokens"`);
    await queryRunner.query(
      `DROP TYPE "public"."device_tokens_plataforma_enum"`,
    );
    await queryRunner.query(`DROP INDEX "public"."uq_recomendacion_activa"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_recomendaciones_cuartel_estado"`,
    );
    await queryRunner.query(`DROP TABLE "recomendaciones"`);
    await queryRunner.query(`DROP TYPE "public"."recomendaciones_estado_enum"`);
    await queryRunner.query(`DROP INDEX "public"."uq_campanias_nombre"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_campanias_empresa_rango"`,
    );
    await queryRunner.query(`DROP TABLE "campanias"`);
  }
}
