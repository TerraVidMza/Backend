import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../../app.module';
import { Rol } from '../../modules/roles/entities/rol.entity';
import { Empresa } from '../../modules/empresas/entities/empresa.entity';
import { Usuario } from '../../modules/usuarios/entities/usuario.entity';
import { CatalogoItem } from '../../modules/catalogo-item/entities/catalogo-item.entity';
import { CATALOGOS_POR_DEFECTO } from '../../modules/catalogo-item/catalogos-por-defecto';
import { Configuracion } from '../../modules/configuracion/entities/configuracion.entity';
import { Campania } from '../../modules/campanias/entities/campania.entity';
import { RolNombre } from '../../common/enums/rol.enum';
import {
  credencialesDelAdministrador,
  credencialesDelPropietario,
} from './credenciales-propietario';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const rolRepo = app.get<Repository<Rol>>(getRepositoryToken(Rol));
  const empresaRepo = app.get<Repository<Empresa>>(getRepositoryToken(Empresa));
  const usuarioRepo = app.get<Repository<Usuario>>(getRepositoryToken(Usuario));
  const catalogoRepo = app.get<Repository<CatalogoItem>>(
    getRepositoryToken(CatalogoItem),
  );
  const configuracionRepo = app.get<Repository<Configuracion>>(
    getRepositoryToken(Configuracion),
  );
  const campaniaRepo = app.get<Repository<Campania>>(
    getRepositoryToken(Campania),
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

  const { email, password, forzarCambio } = credencialesDelPropietario();
  console.log(`Sembrando usuario Propietario (${email})...`);
  const usuarioExistente = await usuarioRepo.findOne({
    where: { email },
  });
  if (!usuarioExistente) {
    const passwordHash = await bcrypt.hash(
      password,
      parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '12', 10),
    );
    await usuarioRepo.save(
      usuarioRepo.create({
        nombre: 'Propietario',
        email,
        passwordHash,
        empresaId: empresa.id,
        rolId: roles[RolNombre.PROPIETARIO].id,
        activo: true,
        // En producción entra con la obligación de cambiarla: la contraseña de
        // arranque la conoce quien haya corrido el seed y quien haya visto la
        // variable de entorno.
        debeCambiarPassword: forzarCambio,
      }),
    );
  } else {
    // El seed es idempotente y no toca lo que ya existe: cambiarle la
    // contraseña a un usuario en uso desde un script de datos iniciales sería
    // una sorpresa desagradable. Para rotarla está `npm run db:rotar-password`.
    console.log('  (ya existía; no se modifica)');
  }

  // Después de la empresa demo: los e2e toman "la primera empresa creada" como
  // la del seed.
  console.log('Sembrando empresa de plataforma (D-025)...');
  let plataforma = await empresaRepo.findOne({ where: { esPlataforma: true } });
  if (!plataforma) {
    plataforma = await empresaRepo.save(
      empresaRepo.create({
        nombre: 'TerraVid (plataforma)',
        cuit: '00-00000000-0',
        activa: true,
        esPlataforma: true,
      }),
    );
  }

  const admin = credencialesDelAdministrador();
  if (!admin) {
    console.log(
      '  Sin SEED_ADMIN_PASSWORD: no se crea Administrador de plataforma.',
    );
  } else if (await usuarioRepo.findOne({ where: { email: admin.email } })) {
    console.log(`  Administrador ${admin.email} ya existía; no se modifica.`);
  } else {
    console.log(`  Sembrando Administrador de plataforma (${admin.email})...`);
    await usuarioRepo.save(
      usuarioRepo.create({
        nombre: 'Administrador de plataforma',
        email: admin.email,
        passwordHash: await bcrypt.hash(
          admin.password,
          parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '12', 10),
        ),
        empresaId: plataforma.id,
        rolId: roles[RolNombre.ADMINISTRADOR].id,
        activo: true,
        debeCambiarPassword: admin.forzarCambio,
      }),
    );
  }

  console.log('Sembrando catálogos maestros...');
  const catalogos = CATALOGOS_POR_DEFECTO;

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

  // El Centro de Ayuda no se siembra (D-036): el manual de cada rol viaja con
  // la Web y la app móvil, y `articulos_ayuda` queda para las preguntas
  // frecuentes que cargue el Propietario.

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
    // variables de entorno.
    //
    // `smtp_from` se siembra **vacía a propósito**, y la fila existe igual para
    // que HU-33 tenga qué editar. `MailService.resolverSmtp` da prioridad a la
    // configuración de la empresa sobre el entorno (`from = f || from`), así que
    // un valor sembrado acá **pisa** a `MAIL_FROM` en producción. Tenía
    // `no-reply@terravid.demo`, un dominio inexistente: el relay aceptaba el
    // mensaje en el protocolo y lo descartaba después, así que la app reportaba
    // éxito y no llegaba ningún correo. La cadena vacía no pisa nada.
    smtp_port: '587',
    smtp_from: '',
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

  console.log('Sembrando campaña actual...');
  // Se siembra una campaña que contiene el día de hoy para que el dashboard y
  // la comparación tengan un corte definido desde el arranque (D-014). El rango
  // arranca el 1 de julio, que es el corte de año agrícola habitual en Cuyo: la
  // vendimia de febrero-abril queda entera dentro de una sola campaña.
  const hoy = new Date();
  const anioInicio =
    hoy.getMonth() + 1 >= 7 ? hoy.getFullYear() : hoy.getFullYear() - 1;
  const nombreCampania = `${anioInicio}/${anioInicio + 1}`;
  const yaExiste = await campaniaRepo.findOne({
    where: { empresaId: empresa.id, nombre: nombreCampania },
  });
  if (!yaExiste) {
    await campaniaRepo.save(
      campaniaRepo.create({
        empresaId: empresa.id,
        nombre: nombreCampania,
        fechaDesde: `${anioInicio}-07-01`,
        fechaHasta: `${anioInicio + 1}-06-30`,
      }),
    );
  }

  // La contraseña solo se repite cuando es la de demostración, que ya está
  // publicada. En producción sale del entorno de quien corre el seed y no
  // tiene por qué quedar escrita en el log del despliegue.
  if (forzarCambio) {
    console.log(`Seed completado. Propietario: ${email}`);
    console.log('Entra con la contraseña de SEED_PROPIETARIO_PASSWORD, y el');
    console.log('sistema le va a exigir cambiarla en el primer acceso.');
  } else {
    console.log(`Seed completado. Usuario demo: ${email} / ${password}`);
  }
  await app.close();
}

seed().catch((error) => {
  console.error('Error al sembrar datos:', error);
  process.exit(1);
});
