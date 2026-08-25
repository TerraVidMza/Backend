import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../../app.module';
import { Rol } from '../../modules/roles/entities/rol.entity';
import { Empresa } from '../../modules/empresas/entities/empresa.entity';
import { Usuario } from '../../modules/usuarios/entities/usuario.entity';
import {
  CatalogoItem,
  CatalogoTipo,
} from '../../modules/catalogo-item/entities/catalogo-item.entity';
import {
  ArticuloAyuda,
  ModuloAyuda,
  TipoArticulo,
} from '../../modules/ayuda/entities/articulo-ayuda.entity';
import { Configuracion } from '../../modules/configuracion/entities/configuracion.entity';
import { RolNombre } from '../../common/enums/rol.enum';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const rolRepo = app.get<Repository<Rol>>(getRepositoryToken(Rol));
  const empresaRepo = app.get<Repository<Empresa>>(getRepositoryToken(Empresa));
  const usuarioRepo = app.get<Repository<Usuario>>(getRepositoryToken(Usuario));
  const catalogoRepo = app.get<Repository<CatalogoItem>>(
    getRepositoryToken(CatalogoItem),
  );
  const articuloAyudaRepo = app.get<Repository<ArticuloAyuda>>(
    getRepositoryToken(ArticuloAyuda),
  );
  const configuracionRepo = app.get<Repository<Configuracion>>(
    getRepositoryToken(Configuracion),
  );

  console.log('Sembrando roles...');
  const roles: Record<string, Rol> = {};
  for (const nombreRol of Object.values(RolNombre)) {
    let rol = await rolRepo.findOne({ where: { nombreRol } });
    if (!rol) {
      rol = await rolRepo.save(rolRepo.create({ nombreRol }));
    }
    roles[nombreRol] = rol;
  }

  console.log('Sembrando empresa demo...');
  let empresa = await empresaRepo.findOne({ where: { cuit: '20-12345678-9' } });
  if (!empresa) {
    empresa = await empresaRepo.save(
      empresaRepo.create({
        nombre: 'Finca Demo TerraVid',
        cuit: '20-12345678-9',
        activa: true,
      }),
    );
  }

  console.log('Sembrando usuario Propietario demo...');
  const emailDemo = 'propietario@terravid.demo';
  let usuario = await usuarioRepo.findOne({ where: { email: emailDemo } });
  if (!usuario) {
    const passwordHash = await bcrypt.hash(
      'Terravid123!',
      parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '12', 10),
    );
    usuario = await usuarioRepo.save(
      usuarioRepo.create({
        nombre: 'Propietario Demo',
        email: emailDemo,
        passwordHash,
        empresaId: empresa.id,
        rolId: roles[RolNombre.PROPIETARIO].id,
        activo: true,
      }),
    );
  }

  console.log('Sembrando catálogos maestros...');
  const catalogos: Array<{ tipo: CatalogoTipo; nombre: string }> = [
    { tipo: CatalogoTipo.VARIEDAD, nombre: 'Malbec' },
    { tipo: CatalogoTipo.VARIEDAD, nombre: 'Cabernet Sauvignon' },
    { tipo: CatalogoTipo.VARIEDAD, nombre: 'Chardonnay' },
    { tipo: CatalogoTipo.SISTEMA_CONDUCCION, nombre: 'Espaldero Alto' },
    { tipo: CatalogoTipo.SISTEMA_CONDUCCION, nombre: 'Parral' },
    { tipo: CatalogoTipo.ESTADO_CUARTEL, nombre: 'Productivo' },
    { tipo: CatalogoTipo.ESTADO_CUARTEL, nombre: 'En implantación' },
    { tipo: CatalogoTipo.UNIDAD_MEDIDA, nombre: 'kg' },
    { tipo: CatalogoTipo.UNIDAD_MEDIDA, nombre: 'litros' },
    { tipo: CatalogoTipo.UNIDAD_MEDIDA, nombre: 'horas' },
  ];

  // Los catálogos son por empresa (D-h): se siembran para la empresa demo, no
  // como valores globales de la instancia.
  for (const item of catalogos) {
    const existente = await catalogoRepo.findOne({
      where: { tipo: item.tipo, nombre: item.nombre, empresaId: empresa.id },
    });
    if (!existente) {
      await catalogoRepo.save(
        catalogoRepo.create({ ...item, empresaId: empresa.id, activo: true }),
      );
    }
  }

  console.log('Sembrando artículos del Centro de Ayuda...');
  const articulos: Array<{
    tipo: TipoArticulo;
    modulo: ModuloAyuda;
    titulo: string;
    contenido: string;
    orden: number;
  }> = [
    {
      tipo: TipoArticulo.MANUAL,
      modulo: ModuloAyuda.AUTENTICACION,
      titulo: 'Cómo iniciar sesión',
      contenido:
        'Ingresá tu email y contraseña en la pantalla de login. Si olvidaste tu contraseña, usá el enlace "Recuperar contraseña".',
      orden: 1,
    },
    {
      tipo: TipoArticulo.FAQ,
      modulo: ModuloAyuda.AUTENTICACION,
      titulo: '¿Qué pasa si fallo el login varias veces?',
      contenido:
        'Después de 5 intentos fallidos, la cuenta se bloquea temporalmente por 15 minutos por seguridad.',
      orden: 1,
    },
    {
      tipo: TipoArticulo.MANUAL,
      modulo: ModuloAyuda.OPERACIONES,
      titulo: 'Registrar una labor en modo offline',
      contenido:
        'La app móvil permite registrar labores sin conexión. Los registros se sincronizan automáticamente al recuperar señal, usando un identificador único para evitar duplicados.',
      orden: 1,
    },
    {
      tipo: TipoArticulo.MANUAL,
      modulo: ModuloAyuda.VENDIMIA,
      titulo: 'Generar un remito de vendimia',
      contenido:
        'Desde el cuartel con pesajes pendientes, generá un borrador de remito. El Propietario o Agrónomo debe aprobarlo o rechazarlo antes de liquidar.',
      orden: 1,
    },
  ];

  for (const articulo of articulos) {
    const existente = await articuloAyudaRepo.findOne({
      where: {
        tipo: articulo.tipo,
        modulo: articulo.modulo,
        titulo: articulo.titulo,
      },
    });
    if (!existente) {
      await articuloAyudaRepo.save(
        articuloAyudaRepo.create({ ...articulo, activo: true }),
      );
    }
  }

  // HU-33. Ninguna de estas claves se sembraba, y varias funcionalidades las
  // leen: sin `support_email` el ticket de soporte nunca notificaba, y sin
  // `zona_horaria` el bucketing por día de HU-32 agrupa en UTC.
  console.log('Sembrando configuración por defecto...');
  const configuracionPorDefecto: Record<string, string> = {
    nombre_organizacion: 'Finca Demo TerraVid',
    moneda: 'ARS',
    unidades: 'metrico',
    zona_horaria: 'America/Argentina/Mendoza',
    support_email: 'soporte@terravid.demo',
    // El SMTP real se carga desde la pantalla de configuración (HU-33) o por
    // variables de entorno. No se siembran vacías: `MailService` interpreta la
    // cadena vacía como "sin configurar" y no debe pisar el valor del entorno.
    smtp_port: '587',
    smtp_from: 'TerraVid <no-reply@terravid.demo>',
  };

  for (const [clave, valor] of Object.entries(configuracionPorDefecto)) {
    const existente = await configuracionRepo.findOne({
      where: { empresaId: empresa.id, clave },
    });
    if (!existente) {
      await configuracionRepo.save(
        configuracionRepo.create({ empresaId: empresa.id, clave, valor }),
      );
    }
  }

  console.log(
    'Seed completado. Usuario demo: propietario@terravid.demo / Terravid123!',
  );
  await app.close();
}

seed().catch((error) => {
  console.error('Error al sembrar datos:', error);
  process.exit(1);
});
