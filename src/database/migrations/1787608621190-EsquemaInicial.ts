import { MigrationInterface, QueryRunner } from 'typeorm';

export class EsquemaInicial1787608621190 implements MigrationInterface {
  name = 'EsquemaInicial1787608621190';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "articulos_ayuda" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tipo" character varying(20) NOT NULL, "modulo" character varying(30) NOT NULL, "titulo" character varying(200) NOT NULL, "contenido" text NOT NULL, "orden" smallint NOT NULL DEFAULT '0', "activo" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), CONSTRAINT "PK_1c8fc94e7b0c628469c6618c6b6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre_rol" character varying(50) NOT NULL, CONSTRAINT "UQ_a722dfef88f835ff0933fda8c8d" UNIQUE ("nombre_rol"), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "usuarios" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre" character varying(100) NOT NULL, "email" character varying(255) NOT NULL, "password_hash" character varying(255) NOT NULL, "empresa_id" uuid NOT NULL, "activo" boolean NOT NULL DEFAULT true, "intentos_fallidos" smallint NOT NULL DEFAULT '0', "bloqueado_hasta" TIMESTAMP WITH TIME ZONE, "ultimo_acceso" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "rol_id" uuid NOT NULL, CONSTRAINT "UQ_446adfc18b35418aac32ae0b7b5" UNIQUE ("email"), CONSTRAINT "PK_d7281c63c176e152e4c531594a8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_446adfc18b35418aac32ae0b7b" ON "usuarios"  ("email") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_usuarios_empresa_activo" ON "usuarios"  ("empresa_id", "activo") `,
    );
    await queryRunner.query(
      `CREATE TABLE "empresas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre" character varying(100) NOT NULL, "cuit" character varying(20) NOT NULL, "activa" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, CONSTRAINT "UQ_d44c02e8554f6356ac1d5c059e7" UNIQUE ("cuit"), CONSTRAINT "PK_ce7b122b37c6499bfd6520873e1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "fincas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre" character varying(100) NOT NULL, "ubicacion" character varying(200), "hectareas" numeric(8,2) NOT NULL, "activa" boolean NOT NULL DEFAULT true, "created_by" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "empresa_id" uuid NOT NULL, "latitud" numeric(10,7), "longitud" numeric(10,7), CONSTRAINT "PK_e0254bfcfb38f68447a5a66f213" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "sensores" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "finca_id" uuid NOT NULL, "codigo" character varying(50) NOT NULL, "tipo" character varying(30) NOT NULL, "descripcion" character varying(200), "activo" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_92cfc5164570aa86542d6398705" UNIQUE ("codigo"), CONSTRAINT "PK_17e80466352f77aff22e06ad334" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "alertas_iot" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sensor_id" uuid NOT NULL, "tipo_alerta" character varying(20) NOT NULL, "valor_lectura" numeric(10,4) NOT NULL, "umbral_superado" numeric(10,4) NOT NULL, "timestamp_lectura" TIMESTAMP WITH TIME ZONE NOT NULL, "estado" character varying(20) NOT NULL DEFAULT 'pendiente', "revisada_por" uuid, "revisada_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_539119580b17c42cedd9825fdbd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "catalogo_item" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tipo" character varying(50) NOT NULL, "nombre" character varying(100) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), CONSTRAINT "PK_9a467a9fe4d72fb65d6c7ee7325" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "configuracion" ("empresa_id" uuid NOT NULL, "clave" character varying(100) NOT NULL, "valor" text NOT NULL, "updated_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_107d0599a37faeefcf13cb3521f" PRIMARY KEY ("empresa_id", "clave"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tickets_soporte" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "usuario_id" uuid NOT NULL, "modulo" character varying(30) NOT NULL, "descripcion" text NOT NULL, "app_version" character varying(30), "estado" character varying(20) NOT NULL DEFAULT 'abierto', "email_enviado" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_854b4321b13c5685c72bc5ab80b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "cuadrillas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "finca_id" uuid NOT NULL, "nombre" character varying(100) NOT NULL, "cantidad_integrantes" smallint NOT NULL, "activa" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), CONSTRAINT "PK_55d242f929c7b92e8dab5d98974" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tarifa_cuadrilla" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "cuadrilla_id" uuid NOT NULL, "tarifa_por_kg" numeric(10,4) NOT NULL, "valid_from" date NOT NULL, "created_by" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_tarifa_cuadrilla_vigencia" UNIQUE ("cuadrilla_id", "valid_from"), CONSTRAINT "PK_c06c64140e00dbfb406a5c4c112" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "cuarteles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "finca_id" uuid NOT NULL, "variedad_id" uuid NOT NULL, "sistema_conduccion_id" uuid NOT NULL, "nombre" character varying(100) NOT NULL, "clon" character varying(50), "anio_implantacion" smallint, "hectareas" numeric(8,2), "estado" character varying(20) NOT NULL DEFAULT 'pendiente', "activo" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), CONSTRAINT "PK_122f6262516d38278b9c7589909" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "insumos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre" character varying(100) NOT NULL, "descripcion" character varying(300), "unidad_medida" character varying(20) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), CONSTRAINT "UQ_0d28ae68a8f742beb176aa51ae0" UNIQUE ("nombre"), CONSTRAINT "PK_b4e1b727a7b140e698e3a3dc7af" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "costo_insumo" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "insumo_id" uuid NOT NULL, "costo_unitario" numeric(12,2) NOT NULL, "valid_from" date NOT NULL, "created_by" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_costo_insumo_vigencia" UNIQUE ("insumo_id", "valid_from"), CONSTRAINT "PK_ce3455b278ebc70158884694084" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "lecturas_iot_historico" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sensor_id" uuid NOT NULL, "valor_promedio" numeric(10,4) NOT NULL, "unidad" character varying(20) NOT NULL, "fecha_hora" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_63720ddadc832243c596a7422f5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_lecturas_hist_sensor_fecha" ON "lecturas_iot_historico"  ("sensor_id", "fecha_hora") `,
    );
    await queryRunner.query(
      `CREATE TABLE "lecturas_iot" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sensor_id" uuid NOT NULL, "valor" numeric(10,4) NOT NULL, "unidad" character varying(20) NOT NULL, "sensor_timestamp" TIMESTAMP WITH TIME ZONE NOT NULL, "received_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4490c0bff300adf5d55f5015a7c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_lecturas_iot_sensor_ts" ON "lecturas_iot"  ("sensor_id", "sensor_timestamp") `,
    );
    await queryRunner.query(
      `CREATE TABLE "log_auditoria" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actor_id" uuid NOT NULL, "accion" character varying(50) NOT NULL, "entidad" character varying(50) NOT NULL, "entidad_id" uuid, "datos_anteriores" jsonb, "datos_nuevos" jsonb, "ip_address" character varying(45), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e26d8eb1eef5936223c2a7d1762" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_log_auditoria_entidad" ON "log_auditoria"  ("entidad", "entidad_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_log_auditoria_actor" ON "log_auditoria"  ("actor_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_log_auditoria_created_at" ON "log_auditoria"  ("created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "notificaciones" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "usuario_id" uuid NOT NULL, "tipo" character varying(50) NOT NULL, "titulo" character varying(200) NOT NULL, "descripcion" text NOT NULL, "url_accion" character varying(500), "leida" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a9d32a419ff58b53a38b5ef85d4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notificaciones_created_at" ON "notificaciones"  ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notificaciones_usuario" ON "notificaciones"  ("usuario_id", "leida", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "remitos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "numero_remito" character varying(20) NOT NULL, "cuartel_id" uuid NOT NULL, "generado_por" uuid NOT NULL, "aprobado_por" uuid, "rechazado_por" uuid, "estado" character varying(20) NOT NULL DEFAULT 'borrador', "total_kg" numeric(10,2), "total_liquidacion" numeric(12,2), "motivo_rechazo" text, "fecha" date NOT NULL, "fecha_generacion" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "fecha_aprobacion" TIMESTAMP WITH TIME ZONE, "fecha_rechazo" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_39a47074e4b99bac6601ffd7510" UNIQUE ("numero_remito"), CONSTRAINT "PK_4a1503cefdeb5013a53e8e7dafd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "pesajes_vendimia" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "local_uuid" uuid NOT NULL, "cuadrilla_id" uuid NOT NULL, "cuartel_id" uuid NOT NULL, "registrado_por" uuid NOT NULL, "remito_id" uuid, "fecha" date NOT NULL, "kg_totales" numeric(10,2) NOT NULL, "tarifa_utilizada" numeric(10,4), "monto_liquidacion" numeric(12,2), "estado_sync" character varying(20) NOT NULL DEFAULT 'sincronizado', "error_message" text, "estado" character varying(20) NOT NULL DEFAULT 'pendiente_remito', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "synced_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_80a7ce8c2955ed692e1e289374a" UNIQUE ("local_uuid"), CONSTRAINT "chk_pesaje_kg_positivos" CHECK ("kg_totales" > 0), CONSTRAINT "PK_63b9726e55f366d57a624f5d508" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_80a7ce8c2955ed692e1e289374" ON "pesajes_vendimia"  ("local_uuid") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_pesajes_remito" ON "pesajes_vendimia"  ("remito_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_pesajes_cuartel_estado" ON "pesajes_vendimia"  ("cuartel_id", "estado") `,
    );
    await queryRunner.query(
      `CREATE TABLE "tipo_labor" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre" character varying(100) NOT NULL, "descripcion" character varying(300), "unidad_medida" character varying(20) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), CONSTRAINT "UQ_59c2d79229a4d6744434d4cc5ee" UNIQUE ("nombre"), CONSTRAINT "PK_e79ede20867c7369b07bb779c8a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "registro_labor" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "local_uuid" uuid NOT NULL, "cuartel_id" uuid NOT NULL, "tipo_labor_id" uuid NOT NULL, "usuario_id" uuid NOT NULL, "fecha" date NOT NULL, "cantidad" numeric(10,2) NOT NULL, "costo_unitario_al_sync" numeric(12,2), "estado_sync" character varying(20) NOT NULL DEFAULT 'sincronizado', "error_message" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "synced_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_7f6d96f211fe8899489941ee505" UNIQUE ("local_uuid"), CONSTRAINT "chk_registro_labor_cantidad_positiva" CHECK ("cantidad" > 0), CONSTRAINT "PK_77ad34b47d85e22cf4940c1b629" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_7f6d96f211fe8899489941ee50" ON "registro_labor"  ("local_uuid") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_registro_labor_cuartel_fecha" ON "registro_labor"  ("cuartel_id", "fecha") `,
    );
    await queryRunner.query(
      `CREATE TABLE "detalle_insumo_labor" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "registro_labor_id" uuid NOT NULL, "insumo_id" uuid NOT NULL, "cantidad_usada" numeric(10,4) NOT NULL, "costo_unitario_al_sync" numeric(12,2), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_detalle_insumo_labor" UNIQUE ("registro_labor_id", "insumo_id"), CONSTRAINT "chk_detalle_cantidad_positiva" CHECK ("cantidad_usada" > 0), CONSTRAINT "PK_6fd7d4f8a164e614a59b73e2413" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "costo_labor" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tipo_labor_id" uuid NOT NULL, "costo_unitario" numeric(12,2) NOT NULL, "valid_from" date NOT NULL, "created_by" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_costo_labor_vigencia" UNIQUE ("tipo_labor_id", "valid_from"), CONSTRAINT "PK_f7b2c4f0d15998283f485cdbb3e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "umbral_sensor" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sensor_id" uuid NOT NULL, "umbral_minimo" numeric(10,4), "umbral_maximo" numeric(10,4), "configurado_por" uuid NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_5582ea2350cdea152f32addfebc" UNIQUE ("sensor_id"), CONSTRAINT "PK_e83acce52ad384efe289b2b4a97" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "token_recuperacion" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "usuario_id" uuid NOT NULL, "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f1a8dfa756f048713c64d9bb933" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_token_recuperacion_hash" ON "token_recuperacion"  ("token_hash") `,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD CONSTRAINT "FK_f7a79f991bd7319aef158bfbd38" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD CONSTRAINT "FK_9e519760a660751f4fa21453d3e" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "empresas" ADD CONSTRAINT "FK_00343924399f6e2c296eef31455" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincas" ADD CONSTRAINT "FK_e5131b348178906f5465458edf0" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincas" ADD CONSTRAINT "FK_07739036636858f41aa865e8e7c" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sensores" ADD CONSTRAINT "FK_ed817132249ca385abedbdf3cb4" FOREIGN KEY ("finca_id") REFERENCES "fincas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "alertas_iot" ADD CONSTRAINT "FK_3cec40fd320a464c6a3c86441b1" FOREIGN KEY ("sensor_id") REFERENCES "sensores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "alertas_iot" ADD CONSTRAINT "FK_fb0026d48c67fefa008927d5ea5" FOREIGN KEY ("revisada_por") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "configuracion" ADD CONSTRAINT "FK_c79d032a38d0be726edf8c8888f" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "configuracion" ADD CONSTRAINT "FK_f9b9ebd3f57683e3ee0741dab47" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tickets_soporte" ADD CONSTRAINT "FK_96979bb4de7fbb15262050dfe4d" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cuadrillas" ADD CONSTRAINT "FK_2d07a57a1901296fcb671257acb" FOREIGN KEY ("finca_id") REFERENCES "fincas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tarifa_cuadrilla" ADD CONSTRAINT "FK_bc9ff6f71c78e75d4847cdca9e8" FOREIGN KEY ("cuadrilla_id") REFERENCES "cuadrillas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tarifa_cuadrilla" ADD CONSTRAINT "FK_9e493b1dddc56d307b68cc3b3ab" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cuarteles" ADD CONSTRAINT "FK_0da3218f74e617ccb6b368b9191" FOREIGN KEY ("finca_id") REFERENCES "fincas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cuarteles" ADD CONSTRAINT "FK_bb89746e8d8872407f376d0a103" FOREIGN KEY ("variedad_id") REFERENCES "catalogo_item"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cuarteles" ADD CONSTRAINT "FK_7476bc108d61727c56e7a7c91d6" FOREIGN KEY ("sistema_conduccion_id") REFERENCES "catalogo_item"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "costo_insumo" ADD CONSTRAINT "FK_9e5c9add0bb7d60a8bbace32d6b" FOREIGN KEY ("insumo_id") REFERENCES "insumos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "costo_insumo" ADD CONSTRAINT "FK_fc1a556647606abb5f0c0eec583" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lecturas_iot_historico" ADD CONSTRAINT "FK_d9a949a7962e107bd54ffd3dfe2" FOREIGN KEY ("sensor_id") REFERENCES "sensores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lecturas_iot" ADD CONSTRAINT "FK_5434c758545fb096850759f257f" FOREIGN KEY ("sensor_id") REFERENCES "sensores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "log_auditoria" ADD CONSTRAINT "FK_067d42c7080b3ef975f0dfc64f8" FOREIGN KEY ("actor_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notificaciones" ADD CONSTRAINT "FK_2c6341d5bd206ff522b35aa6b69" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "remitos" ADD CONSTRAINT "FK_c6bbf2255c39a6cef85ac3d95e5" FOREIGN KEY ("cuartel_id") REFERENCES "cuarteles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "remitos" ADD CONSTRAINT "FK_aecf4326effbf02bcd7e3a254ad" FOREIGN KEY ("generado_por") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "remitos" ADD CONSTRAINT "FK_76b33310dae76a2e73a8ee04d84" FOREIGN KEY ("aprobado_por") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "remitos" ADD CONSTRAINT "FK_5f00c2695dd939e50a4a15a7658" FOREIGN KEY ("rechazado_por") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pesajes_vendimia" ADD CONSTRAINT "FK_e536e2c39394336acdb2ee3679f" FOREIGN KEY ("cuadrilla_id") REFERENCES "cuadrillas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pesajes_vendimia" ADD CONSTRAINT "FK_1a30fc289ce5583814609dfd459" FOREIGN KEY ("cuartel_id") REFERENCES "cuarteles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pesajes_vendimia" ADD CONSTRAINT "FK_9f840488a7bfce214248bb14ac5" FOREIGN KEY ("registrado_por") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pesajes_vendimia" ADD CONSTRAINT "FK_5431df22cee1a35e97e446d4781" FOREIGN KEY ("remito_id") REFERENCES "remitos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "registro_labor" ADD CONSTRAINT "FK_b0f50caec3a871aae0f0521be2b" FOREIGN KEY ("cuartel_id") REFERENCES "cuarteles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "registro_labor" ADD CONSTRAINT "FK_f61346bb8a50b49a279d7084ea3" FOREIGN KEY ("tipo_labor_id") REFERENCES "tipo_labor"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "registro_labor" ADD CONSTRAINT "FK_8aed91dd8dd2d445914874f7978" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "detalle_insumo_labor" ADD CONSTRAINT "FK_6aa08a45d8446f4e307deb613a9" FOREIGN KEY ("registro_labor_id") REFERENCES "registro_labor"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "detalle_insumo_labor" ADD CONSTRAINT "FK_08b9b5e879cdd36bd497ac304f7" FOREIGN KEY ("insumo_id") REFERENCES "insumos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "costo_labor" ADD CONSTRAINT "FK_fee166cb9cb9892e9661a88996f" FOREIGN KEY ("tipo_labor_id") REFERENCES "tipo_labor"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "costo_labor" ADD CONSTRAINT "FK_8a5f1b9790707e6eae739df42fb" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "umbral_sensor" ADD CONSTRAINT "FK_5582ea2350cdea152f32addfebc" FOREIGN KEY ("sensor_id") REFERENCES "sensores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "umbral_sensor" ADD CONSTRAINT "FK_d5a53987f559a0f11f4611cb668" FOREIGN KEY ("configurado_por") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "token_recuperacion" ADD CONSTRAINT "FK_fd61139b95d7ea0753e04e6a9d6" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "token_recuperacion" DROP CONSTRAINT "FK_fd61139b95d7ea0753e04e6a9d6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "umbral_sensor" DROP CONSTRAINT "FK_d5a53987f559a0f11f4611cb668"`,
    );
    await queryRunner.query(
      `ALTER TABLE "umbral_sensor" DROP CONSTRAINT "FK_5582ea2350cdea152f32addfebc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "costo_labor" DROP CONSTRAINT "FK_8a5f1b9790707e6eae739df42fb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "costo_labor" DROP CONSTRAINT "FK_fee166cb9cb9892e9661a88996f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "detalle_insumo_labor" DROP CONSTRAINT "FK_08b9b5e879cdd36bd497ac304f7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "detalle_insumo_labor" DROP CONSTRAINT "FK_6aa08a45d8446f4e307deb613a9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registro_labor" DROP CONSTRAINT "FK_8aed91dd8dd2d445914874f7978"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registro_labor" DROP CONSTRAINT "FK_f61346bb8a50b49a279d7084ea3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registro_labor" DROP CONSTRAINT "FK_b0f50caec3a871aae0f0521be2b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pesajes_vendimia" DROP CONSTRAINT "FK_5431df22cee1a35e97e446d4781"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pesajes_vendimia" DROP CONSTRAINT "FK_9f840488a7bfce214248bb14ac5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pesajes_vendimia" DROP CONSTRAINT "FK_1a30fc289ce5583814609dfd459"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pesajes_vendimia" DROP CONSTRAINT "FK_e536e2c39394336acdb2ee3679f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "remitos" DROP CONSTRAINT "FK_5f00c2695dd939e50a4a15a7658"`,
    );
    await queryRunner.query(
      `ALTER TABLE "remitos" DROP CONSTRAINT "FK_76b33310dae76a2e73a8ee04d84"`,
    );
    await queryRunner.query(
      `ALTER TABLE "remitos" DROP CONSTRAINT "FK_aecf4326effbf02bcd7e3a254ad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "remitos" DROP CONSTRAINT "FK_c6bbf2255c39a6cef85ac3d95e5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notificaciones" DROP CONSTRAINT "FK_2c6341d5bd206ff522b35aa6b69"`,
    );
    await queryRunner.query(
      `ALTER TABLE "log_auditoria" DROP CONSTRAINT "FK_067d42c7080b3ef975f0dfc64f8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lecturas_iot" DROP CONSTRAINT "FK_5434c758545fb096850759f257f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lecturas_iot_historico" DROP CONSTRAINT "FK_d9a949a7962e107bd54ffd3dfe2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "costo_insumo" DROP CONSTRAINT "FK_fc1a556647606abb5f0c0eec583"`,
    );
    await queryRunner.query(
      `ALTER TABLE "costo_insumo" DROP CONSTRAINT "FK_9e5c9add0bb7d60a8bbace32d6b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cuarteles" DROP CONSTRAINT "FK_7476bc108d61727c56e7a7c91d6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cuarteles" DROP CONSTRAINT "FK_bb89746e8d8872407f376d0a103"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cuarteles" DROP CONSTRAINT "FK_0da3218f74e617ccb6b368b9191"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tarifa_cuadrilla" DROP CONSTRAINT "FK_9e493b1dddc56d307b68cc3b3ab"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tarifa_cuadrilla" DROP CONSTRAINT "FK_bc9ff6f71c78e75d4847cdca9e8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cuadrillas" DROP CONSTRAINT "FK_2d07a57a1901296fcb671257acb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tickets_soporte" DROP CONSTRAINT "FK_96979bb4de7fbb15262050dfe4d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "configuracion" DROP CONSTRAINT "FK_f9b9ebd3f57683e3ee0741dab47"`,
    );
    await queryRunner.query(
      `ALTER TABLE "configuracion" DROP CONSTRAINT "FK_c79d032a38d0be726edf8c8888f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alertas_iot" DROP CONSTRAINT "FK_fb0026d48c67fefa008927d5ea5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alertas_iot" DROP CONSTRAINT "FK_3cec40fd320a464c6a3c86441b1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sensores" DROP CONSTRAINT "FK_ed817132249ca385abedbdf3cb4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincas" DROP CONSTRAINT "FK_07739036636858f41aa865e8e7c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fincas" DROP CONSTRAINT "FK_e5131b348178906f5465458edf0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "empresas" DROP CONSTRAINT "FK_00343924399f6e2c296eef31455"`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP CONSTRAINT "FK_9e519760a660751f4fa21453d3e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP CONSTRAINT "FK_f7a79f991bd7319aef158bfbd38"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_token_recuperacion_hash"`,
    );
    await queryRunner.query(`DROP TABLE "token_recuperacion"`);
    await queryRunner.query(`DROP TABLE "umbral_sensor"`);
    await queryRunner.query(`DROP TABLE "costo_labor"`);
    await queryRunner.query(`DROP TABLE "detalle_insumo_labor"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_registro_labor_cuartel_fecha"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7f6d96f211fe8899489941ee50"`,
    );
    await queryRunner.query(`DROP TABLE "registro_labor"`);
    await queryRunner.query(`DROP TABLE "tipo_labor"`);
    await queryRunner.query(`DROP INDEX "public"."idx_pesajes_cuartel_estado"`);
    await queryRunner.query(`DROP INDEX "public"."idx_pesajes_remito"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_80a7ce8c2955ed692e1e289374"`,
    );
    await queryRunner.query(`DROP TABLE "pesajes_vendimia"`);
    await queryRunner.query(`DROP TABLE "remitos"`);
    await queryRunner.query(`DROP INDEX "public"."idx_notificaciones_usuario"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_notificaciones_created_at"`,
    );
    await queryRunner.query(`DROP TABLE "notificaciones"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_log_auditoria_created_at"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_log_auditoria_actor"`);
    await queryRunner.query(`DROP INDEX "public"."idx_log_auditoria_entidad"`);
    await queryRunner.query(`DROP TABLE "log_auditoria"`);
    await queryRunner.query(`DROP INDEX "public"."idx_lecturas_iot_sensor_ts"`);
    await queryRunner.query(`DROP TABLE "lecturas_iot"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_lecturas_hist_sensor_fecha"`,
    );
    await queryRunner.query(`DROP TABLE "lecturas_iot_historico"`);
    await queryRunner.query(`DROP TABLE "costo_insumo"`);
    await queryRunner.query(`DROP TABLE "insumos"`);
    await queryRunner.query(`DROP TABLE "cuarteles"`);
    await queryRunner.query(`DROP TABLE "tarifa_cuadrilla"`);
    await queryRunner.query(`DROP TABLE "cuadrillas"`);
    await queryRunner.query(`DROP TABLE "tickets_soporte"`);
    await queryRunner.query(`DROP TABLE "configuracion"`);
    await queryRunner.query(`DROP TABLE "catalogo_item"`);
    await queryRunner.query(`DROP TABLE "alertas_iot"`);
    await queryRunner.query(`DROP TABLE "sensores"`);
    await queryRunner.query(`DROP TABLE "fincas"`);
    await queryRunner.query(`DROP TABLE "empresas"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_usuarios_empresa_activo"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_446adfc18b35418aac32ae0b7b"`,
    );
    await queryRunner.query(`DROP TABLE "usuarios"`);
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(`DROP TABLE "articulos_ayuda"`);
  }
}
