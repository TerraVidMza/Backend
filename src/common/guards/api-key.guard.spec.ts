import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';

function buildContext(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  const guard = new ApiKeyGuard();
  const original = process.env.IOT_API_KEY;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.IOT_API_KEY;
    } else {
      process.env.IOT_API_KEY = original;
    }
  });

  it('rechaza cuando no hay clave configurada, en vez de dejar el endpoint abierto', () => {
    delete process.env.IOT_API_KEY;
    expect(() => guard.canActivate(buildContext({}))).toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza el request sin header X-Api-Key', () => {
    process.env.IOT_API_KEY = 'clave-de-prueba';
    expect(() => guard.canActivate(buildContext({}))).toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza una clave incorrecta', () => {
    process.env.IOT_API_KEY = 'clave-de-prueba';
    expect(() =>
      guard.canActivate(buildContext({ 'x-api-key': 'clave-incorrecta' })),
    ).toThrow(UnauthorizedException);
  });

  it('rechaza una clave con el prefijo correcto pero distinta longitud', () => {
    process.env.IOT_API_KEY = 'clave-de-prueba';
    expect(() =>
      guard.canActivate(buildContext({ 'x-api-key': 'clave-de-prueba-larga' })),
    ).toThrow(UnauthorizedException);
  });

  it('acepta la clave correcta', () => {
    process.env.IOT_API_KEY = 'clave-de-prueba';
    expect(
      guard.canActivate(buildContext({ 'x-api-key': 'clave-de-prueba' })),
    ).toBe(true);
  });
});
