import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDniLookupService, dniLookupOptions } from '../../server/dni/lookup.service';
import { ApiDniProvider, createDniProvider, MockDniProvider } from '../../server/dni/providers';
import { DniProviderError, type DniLookupResult } from '../../server/dni/provider';

const dni = '12345678';
const data = { dni, firstName: '  Ana   María ', paternalLastName: ' Muñoz ', maternalLastName: ' Álvarez ', source: 'test' };
afterEach(() => vi.restoreAllMocks());
function setup() {
  const local = vi.fn<() => Promise<{ dni: string; firstName: string; lastName: string } | null>>().mockResolvedValue(null);
  const lookup = vi.fn<() => Promise<DniLookupResult | null>>().mockResolvedValue(data);
  return { local, lookup, service: createDniLookupService(local, { lookup }, { backoffMs: 1, timeoutMs: 40 }) };
}
describe('DNI local-first y caché temporal', () => {
  it('DNI local normalizado evita proveedor y conserva correcciones', async () => {
    const { local, lookup, service } = setup(); const client = { dni, firstName: 'Nombre corregido', lastName: 'Apellido local' }; local.mockResolvedValue(client);
    expect(await service.lookup(' 1234 5678 ')).toEqual({ source: 'LOCAL', client }); expect(local).toHaveBeenCalledWith(dni); expect(lookup).not.toHaveBeenCalled();
  });
  it.each(['123', '123456789', '1234A678', '', null])('DNI inválido %s no consulta DB ni proveedor', async value => {
    const { local, lookup, service } = setup(); await expect(service.lookup(value)).rejects.toMatchObject({ code: 'DNI_INVALID', status: 400 }); expect(local).not.toHaveBeenCalled(); expect(lookup).not.toHaveBeenCalled();
  });
  it('consulta externo, normaliza nombres, elimina campos no autorizados', async () => {
    const { lookup, service } = setup();
    lookup.mockResolvedValue({ ...data, phone: 'secret-phone', email: 'private@example.test', token: 'secret-token' } as DniLookupResult);
    expect(await service.lookup(dni)).toEqual({ source: 'EXTERNAL', data: { dni, firstName: 'Ana María', lastName: 'Muñoz Álvarez' } });
  });
  it('prefiere apellido compuesto explícito sin alterar Ñ/tildes', async () => {
    const { lookup, service } = setup(); lookup.mockResolvedValue({ ...data, lastName: '  Peña   del Río ' });
    expect(await service.lookup(dni)).toMatchObject({ data: { lastName: 'Peña del Río' } });
  });
  it('not found no reintenta', async () => { const { lookup, service } = setup(); lookup.mockResolvedValue(null); expect(await service.lookup(dni)).toMatchObject({ source: 'NONE', error: { code: 'DNI_NOT_FOUND' } }); expect(lookup).toHaveBeenCalledTimes(1); });
  it.each([{ ...data, dni: '87654321' }, { ...data, firstName: '' }, { ...data, firstName: undefined }, { ...data, firstName: 'A'.repeat(101) }, { dni, fullName: 'Sólo nombre completo', source: 'test' }])('respuesta incompleta/inconsistente no reintenta', async raw => {
    const { lookup, service } = setup(); lookup.mockResolvedValue(raw); expect(await service.lookup(dni)).toMatchObject({ error: { code: 'DNI_PROVIDER_INVALID_RESPONSE' } }); expect(lookup).toHaveBeenCalledTimes(1);
  });
  it.each(['DNI_PROVIDER_UNAVAILABLE', 'DNI_PROVIDER_RATE_LIMIT', 'DNI_PROVIDER_TIMEOUT'] as const)('%s reintenta y recupera', async code => {
    const { lookup, service } = setup(); lookup.mockRejectedValueOnce(new DniProviderError(code)); expect(await service.lookup(dni)).toMatchObject({ source: 'EXTERNAL' }); expect(lookup).toHaveBeenCalledTimes(2);
  });
  it('máximo dos intentos y mensajes sin detalle técnico', async () => {
    const { lookup, service } = setup(); lookup.mockRejectedValue(new Error('secret-token private-payload'));
    const result = await service.lookup(dni); expect(result).toMatchObject({ source: 'NONE', error: { code: 'DNI_PROVIDER_UNAVAILABLE' } }); expect(JSON.stringify(result)).not.toContain('secret'); expect(lookup).toHaveBeenCalledTimes(2);
  });
  it('proveedor colgado se aborta dentro del límite global', async () => {
    const { local } = setup(); const signals: AbortSignal[] = [];
    const lookup = vi.fn((_dni: string, signal?: AbortSignal) => { signals.push(signal!); return new Promise<null>(() => {}); });
    const service = createDniLookupService(local, { lookup }, { timeoutMs: 30, backoffMs: 1 });
    expect(await service.lookup(dni)).toMatchObject({ error: { code: 'DNI_PROVIDER_TIMEOUT' } }); expect(lookup).toHaveBeenCalledTimes(2); expect(signals.every(signal => signal.aborted)).toBe(true);
  });
  it('dos llamadas y llamadas simultáneas reutilizan resultado', async () => {
    const { lookup, service } = setup(); await Promise.all([service.lookup(dni), service.lookup(dni)]); await service.lookup(dni); expect(lookup).toHaveBeenCalledTimes(1);
  });
  it('caché expira y tiene límite de entradas', async () => {
    let now = 0; const local = async () => null;
    const lookup = vi.fn(async (value: string) => ({ ...data, dni: value }));
    const service = createDniLookupService(local, { lookup }, { now: () => now, cacheTtlMs: 60, maxCacheEntries: 2 });
    await service.lookup(dni); await service.lookup(dni); expect(lookup).toHaveBeenCalledTimes(1);
    now = 61; await service.lookup(dni); expect(lookup).toHaveBeenCalledTimes(2);
    await service.lookup('12345679'); await service.lookup('12345680'); await service.lookup(dni); expect(lookup).toHaveBeenCalledTimes(5);
  });
  it('cliente local gana sobre caché externa', async () => {
    const { local, lookup, service } = setup(); await service.lookup(dni); local.mockResolvedValue({ dni, firstName: 'Corregido', lastName: 'Local' });
    expect(await service.lookup(dni)).toMatchObject({ source: 'LOCAL' }); expect(lookup).toHaveBeenCalledTimes(1);
  });
  it('cliente creado durante consulta tiene prioridad sobre proveedor', async () => {
    const { local, lookup, service } = setup(); local.mockResolvedValueOnce(null).mockResolvedValue({ dni, firstName: 'Nuevo local', lastName: 'Corregido' });
    expect(await service.lookup(dni)).toMatchObject({ source: 'LOCAL', client: { firstName: 'Nuevo local' } }); expect(lookup).toHaveBeenCalledTimes(1);
  });
  it('errores transitorios no se cachean: reintento explícito puede recuperar', async () => {
    const { lookup, service } = setup(); lookup.mockRejectedValueOnce(new DniProviderError('DNI_PROVIDER_UNAVAILABLE')).mockRejectedValueOnce(new DniProviderError('DNI_PROVIDER_UNAVAILABLE'));
    expect(await service.lookup(dni)).toMatchObject({ source: 'NONE' }); expect(await service.lookup(dni)).toMatchObject({ source: 'EXTERNAL' }); expect(lookup).toHaveBeenCalledTimes(3);
  });
});
describe('Adaptador API y factory sin red real', () => {
  it('usa Bearer sólo hacia servidor proveedor y query dni', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(data)));
    const provider = new ApiDniProvider('https://dni.example.test/lookup', 'private-test-token', fetcher);
    await provider.lookup(dni); expect(fetcher.mock.calls[0][0].toString()).toBe(`https://dni.example.test/lookup?dni=${dni}`);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: 'error', headers: { Authorization: 'Bearer private-test-token' } });
  });
  it.each([[404, 'DNI_NOT_FOUND', 1], [400, 'DNI_PROVIDER_INVALID_RESPONSE', 1], [500, 'DNI_PROVIDER_UNAVAILABLE', 2], [429, 'DNI_PROVIDER_RATE_LIMIT', 2]])('HTTP %i normalizado y %i intentos', async (status, code, calls) => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response('sensitive upstream detail', { status: Number(status) }));
    const service = createDniLookupService(async () => null, new ApiDniProvider('https://dni.example.test/lookup', 'secret', fetcher), { backoffMs: 1 });
    const result = await service.lookup(dni); expect(result).toMatchObject({ source: 'NONE', error: { code } }); expect(fetcher).toHaveBeenCalledTimes(Number(calls)); expect(JSON.stringify(result)).not.toContain('sensitive');
  });
  it.each(['not json', JSON.stringify({ dni, firstName: 'A' }), 'x'.repeat(17000)])('payload inválido controlado', async body => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(body));
    const service = createDniLookupService(async () => null, new ApiDniProvider('https://dni.example.test/lookup', 'secret', fetcher));
    expect(await service.lookup(dni)).toMatchObject({ error: { code: 'DNI_PROVIDER_INVALID_RESPONSE' } }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('500 seguido de 200 recupera y no registra token/payload', async () => {
    const logs = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('private', { status: 500 })).mockResolvedValueOnce(new Response(JSON.stringify(data)));
    const service = createDniLookupService(async () => null, new ApiDniProvider('https://dni.example.test/lookup', 'secret', fetcher), { backoffMs: 1 });
    expect(await service.lookup(dni)).toMatchObject({ source: 'EXTERNAL' }); expect(logs).not.toHaveBeenCalled();
  });
  it('factory mock reproduce fixtures; desconocido no inventa identidad', async () => {
    const provider = createDniProvider({ DNI_PROVIDER: 'mock' }); expect(provider).toBeInstanceOf(MockDniProvider);
    expect(await provider.lookup(dni)).toMatchObject({ dni }); expect(await provider.lookup('00123456')).toBeNull();
  });
  it('factory api y configuración ausente fallan de forma segura', async () => {
    expect(createDniProvider({ DNI_PROVIDER: 'api' })).toBeInstanceOf(ApiDniProvider);
    await expect(createDniProvider({ DNI_PROVIDER: 'api' }).lookup(dni)).rejects.toMatchObject({ code: 'DNI_PROVIDER_UNAVAILABLE' });
    await expect(createDniProvider({ NODE_ENV: 'production', DNI_PROVIDER: 'mock' }).lookup(dni)).rejects.toMatchObject({ code: 'DNI_PROVIDER_UNAVAILABLE' });
  });
  it('configuración acota timeout y caché', () => {
    expect(dniLookupOptions({ DNI_TIMEOUT_MS: 'invalid', DNI_CACHE_TTL_MS: '999999' })).toEqual({ timeoutMs: 4000, cacheTtlMs: 60000 });
  });
});
