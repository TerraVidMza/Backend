import { ServiceUnavailableException } from '@nestjs/common';
import { coincide, type MqttConexionService } from './mqtt-conexion.service';
import { DynsecService, topicoDeLecturas } from './dynsec.service';
import { IngestaMqttService } from './ingesta-mqtt.service';
import type { LecturasIotService } from '../lecturas-iot/lecturas-iot.service';

const TOPICO_RESPUESTA = '$CONTROL/dynamic-security/v1/response';

describe('coincide (filtros MQTT)', () => {
  it.each([
    ['terravid/sensores/+/lecturas', 'terravid/sensores/S-1/lecturas', true],
    ['terravid/sensores/+/lecturas', 'terravid/sensores/S-1/otra', false],
    ['terravid/sensores/+/lecturas', 'terravid/sensores/lecturas', false],
    [TOPICO_RESPUESTA, TOPICO_RESPUESTA, true],
    ['terravid/#', 'terravid/sensores/S-1/lecturas', true],
  ])('%s vs %s → %s', (filtro, topico, esperado) => {
    expect(coincide(filtro, topico)).toBe(esperado);
  });
});

/**
 * Broker falso: responde a cada comando de dynamic security como Mosquitto,
 * con el mismo `correlationData`, y deja registrado lo que se le mandó.
 */
function brokerFalso(
  opciones: { errores?: Record<string, string>; yaTieneRol?: boolean } = {},
) {
  const enviados: Array<Record<string, unknown>> = [];
  let alResponder: ((t: string, p: Buffer) => void) | null = null;
  let alConectar: (() => void) | null = null;
  const conexion = {
    habilitada: true,
    usuario: 'terravid-api',
    suscribir: jest.fn((_f: string, m: (t: string, p: Buffer) => void) => {
      alResponder = m;
    }),
    alConectar: jest.fn((cb: () => void) => {
      alConectar = cb;
    }),
    publicar: jest.fn((_topico: string, payload: string) => {
      const { commands } = JSON.parse(payload) as {
        commands: Array<Record<string, unknown>>;
      };
      enviados.push(...commands);
      const responses = commands
        .filter((c) => c.correlationData)
        .map((c) => ({
          command: c.command,
          correlationData: c.correlationData,
          error: opciones.errores?.[c.command as string],
          data:
            c.command === 'getClient'
              ? {
                  client: {
                    roles: opciones.yaTieneRol
                      ? [{ rolename: 'terravid-ingesta' }]
                      : [],
                  },
                }
              : undefined,
        }));
      if (responses.length) {
        setImmediate(() =>
          alResponder?.(
            TOPICO_RESPUESTA,
            Buffer.from(JSON.stringify({ responses })),
          ),
        );
      }
      return Promise.resolve();
    }),
  };
  return { conexion, enviados, conectar: () => alConectar?.() };
}

const esperarUnPoco = () => new Promise((r) => setTimeout(r, 20));

describe('DynsecService (D-026)', () => {
  function crear(opciones?: Parameters<typeof brokerFalso>[0]) {
    const broker = brokerFalso(opciones);
    const servicio = new DynsecService(
      broker.conexion as unknown as MqttConexionService,
    );
    servicio.onApplicationBootstrap();
    return { servicio, ...broker };
  }

  it('crea un rol por sensor que solo puede publicar en su tópico', async () => {
    const { servicio, enviados } = crear();

    const password = await servicio.crearCredencial('S-1');

    expect(password.length).toBeGreaterThanOrEqual(20);
    expect(enviados.find((c) => c.command === 'createRole')).toMatchObject({
      rolename: 'sensor-S-1',
      acls: [
        {
          acltype: 'publishClientSend',
          topic: topicoDeLecturas('S-1'),
          allow: true,
        },
      ],
    });
    expect(enviados.find((c) => c.command === 'createClient')).toMatchObject({
      username: 'S-1',
      password,
      roles: [{ rolename: 'sensor-S-1' }],
    });
  });

  it('regenerar borra la credencial anterior antes de crear la nueva', async () => {
    const { servicio, enviados } = crear();
    await servicio.crearCredencial('S-1');
    expect(enviados.slice(0, 2).map((c) => c.command)).toEqual([
      'deleteClient',
      'deleteRole',
    ]);
  });

  it('informa si el broker rechaza la creación', async () => {
    const { servicio } = crear({
      errores: { createClient: 'Client already exists' },
    });
    await expect(servicio.crearCredencial('S-1')).rejects.toThrow(
      /createClient/,
    );
  });

  it('al conectarse agrega el rol de ingesta si falta, sin esperar respuesta', async () => {
    const { enviados, conectar } = crear();
    conectar();
    await esperarUnPoco();
    expect(enviados.map((c) => c.command)).toEqual([
      'getClient',
      'createRole',
      'addClientRole',
    ]);
    // Sin correlationData: el broker corta la conexión y no hay respuesta.
    expect(enviados[2].correlationData).toBeUndefined();
  });

  it('si ya tiene el rol no lo vuelve a agregar (el broker lo desconectaría)', async () => {
    const { enviados, conectar } = crear({ yaTieneRol: true });
    conectar();
    await esperarUnPoco();
    expect(enviados.map((c) => c.command)).toEqual(['getClient']);
  });

  it('deshabilitar y eliminar no fallan aunque el broker los rechace', async () => {
    const { servicio } = crear({
      errores: { disableClient: 'Client not found' },
    });
    await expect(servicio.deshabilitar('S-1')).resolves.toBeUndefined();
    await expect(servicio.eliminar('S-1')).resolves.toBeUndefined();
  });

  it('sin MQTT no puede generar credenciales', async () => {
    const servicio = new DynsecService({
      habilitada: false,
    } as MqttConexionService);
    await expect(servicio.crearCredencial('S-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

describe('IngestaMqttService (D-026)', () => {
  const lecturas = { ingest: jest.fn() };
  const servicio = new IngestaMqttService(
    { habilitada: false } as MqttConexionService,
    lecturas as unknown as LecturasIotService,
  );
  const topico = 'terravid/sensores/S-1/lecturas';
  const json = (o: unknown) => Buffer.from(JSON.stringify(o));
  const ahora = '2026-10-05T12:00:00Z';

  beforeEach(() => lecturas.ingest.mockReset());

  it('toma el código del tópico, no del payload', async () => {
    await servicio.procesar(
      topico,
      json({
        valor: 21.5,
        unidad: '%',
        sensorTimestamp: ahora,
        codigoSensor: 'OTRO',
      }),
    );
    expect(lecturas.ingest).toHaveBeenCalledWith(
      expect.objectContaining({ codigoSensor: 'S-1', valor: 21.5 }),
    );
  });

  it.each([
    ['payload que no es JSON', Buffer.from('no-json')],
    ['payload que no es un objeto', json(42)],
    [
      'valor no numérico',
      json({ valor: 'alto', unidad: '%', sensorTimestamp: ahora }),
    ],
    ['payload sin fecha', json({ valor: 1, unidad: '%' })],
  ])('descarta un %s sin llegar a la ingesta', async (_caso, payload) => {
    await servicio.procesar(topico, payload);
    expect(lecturas.ingest).not.toHaveBeenCalled();
  });

  it('un rechazo de la ingesta (sensor dado de baja) no rompe la suscripción', async () => {
    lecturas.ingest.mockRejectedValueOnce(new Error('dado de baja'));
    await expect(
      servicio.procesar(
        topico,
        json({ valor: 1, unidad: '%', sensorTimestamp: ahora }),
      ),
    ).resolves.toBeUndefined();
  });
});
