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
import { RolNombre } from '../../common/enums/rol.enum';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const rolRepo = app.get<Repository<Rol>>(getRepositoryToken(Rol));
  const empresaRepo = app.get<Repository<Empresa>>(getRepositoryToken(Empresa));
  const usuarioRepo = app.get<Repository<Usuario>>(getRepositoryToken(Usuario));
  const catalogoRepo = app.get<Repository<CatalogoItem>>(
    getRepositoryToken(CatalogoItem),
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
    const passwordHash = await bcrypt.hash('Terravid123!', 10);
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

  for (const item of catalogos) {
    const existente = await catalogoRepo.findOne({
      where: { tipo: item.tipo, nombre: item.nombre },
    });
    if (!existente) {
      await catalogoRepo.save(catalogoRepo.create({ ...item, activo: true }));
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
