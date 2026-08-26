import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FindOperator } from 'typeorm';

import { ConfiguracionService } from './configuracion.service';
import { Configuracion } from './entities/configuracion.entity';
import { CLAVES_PREFERENCIAS, CLAVES_SECRETAS } from './configuracion.keys';

const EMPRESA_ID = '11111111-1111-1111-1111-111111111111';

/**
 * `GET /configuracion/preferencias` (D-020).
 *
 * Toda la interfaz necesita `moneda`, `unidades` y `zona_horaria` para
 * formatear lo que muestra, y hasta ahora solo el Propietario podía leerlas: el
 * resto de los roles veía los importes con el formato por defecto del
 * navegador. La respuesta no fue abrir `GET /configuracion` porque ese endpoint
 * enmascara únicamente `smtp_pass` —el host, el puerto, el usuario y el
 * remitente viajan en claro—, así que se agregó una lista blanca.
 *
 * Lo que estos tests cuidan es justamente la lista: que no crezca hacia las
 * claves del SMTP sin que nadie se dé cuenta.
 */
describe('ConfiguracionService.findPreferencias', () => {
  let service: ConfiguracionService;
  let repo: { find: jest.Mock; findOne: jest.Mock };

  beforeEach(async () => {
    repo = {
      find: jest.fn(() => Promise.resolve([])),
      findOne: jest.fn(() => Promise.resolve(null)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConfiguracionService,
        { provide: getRepositoryToken(Configuracion), useValue: repo },
      ],
    }).compile();

    service = moduleRef.get(ConfiguracionService);
  });

  it('consulta solo las claves de la lista blanca, acotadas a la empresa', async () => {
    await service.findPreferencias(EMPRESA_ID);

    const [{ where }] = repo.find.mock.calls[0] as [
      { where: { empresaId: string; clave: FindOperator<string> } },
    ];

    expect(where.empresaId).toBe(EMPRESA_ID);
    expect(where.clave.value).toEqual([...CLAVES_PREFERENCIAS]);
  });

  it('una empresa sin nada configurado devuelve la lista vacía', async () => {
    // El cliente cae a sus propios valores por defecto; no es un 404.
    await expect(service.findPreferencias(EMPRESA_ID)).resolves.toEqual([]);
  });

  it('ninguna preferencia es una clave secreta', () => {
    const secretas = CLAVES_PREFERENCIAS.filter((c) => CLAVES_SECRETAS.has(c));
    expect(secretas).toEqual([]);
  });

  /**
   * El endpoint es `@AnyRole()`. `smtp_host`, `smtp_port`, `smtp_user` y
   * `smtp_from` no se enmascaran en ningún lado: si alguna entrara a la lista,
   * media credencial de correo quedaría disponible para cualquier usuario
   * autenticado, incluido el Auditor.
   */
  it('ninguna preferencia es una clave del SMTP', () => {
    const smtp = CLAVES_PREFERENCIAS.filter((c) => c.startsWith('smtp_'));
    expect(smtp).toEqual([]);
  });
});
