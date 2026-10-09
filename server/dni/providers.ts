import { DniProviderError, type DniLookupResult, type DniProvider } from './provider.js';

// Datos ficticios; nunca derivar identidades arbitrarias desde un DNI desconocido.
const fixtures: Record<string, DniLookupResult> = {
  '12345678': { dni: '12345678', firstName: '  Ana   María ', paternalLastName: 'Muñoz', maternalLastName: 'Álvarez', source: 'mock' },
  '12345679': { dni: '12345679', firstName: 'Luis Andrés', lastName: 'Pérez Rojas', source: 'mock' },
  '12345680': { dni: '12345680', firstName: 'Lucía Elena', lastName: 'Peña del Río', source: 'mock' },
};
export class MockDniProvider implements DniProvider {
  async lookup(dni: string) {
    if (dni === '99999999') throw new DniProviderError('DNI_PROVIDER_UNAVAILABLE');
    return fixtures[dni] ? { ...fixtures[dni] } : null;
  }
}
class UnavailableDniProvider implements DniProvider {
  async lookup(): Promise<null> { throw new DniProviderError('DNI_PROVIDER_UNAVAILABLE'); }
}
export class ApiDniProvider implements DniProvider {
  constructor(private readonly endpoint: string, private readonly token: string, private readonly fetcher: typeof fetch = fetch) {}
  async lookup(dni: string, signal?: AbortSignal): Promise<DniLookupResult | null> {
    let url: URL;
    try { url = new URL(this.endpoint); } catch { throw new DniProviderError('DNI_PROVIDER_UNAVAILABLE'); }
    if (!this.token || url.username || url.password || (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new DniProviderError('DNI_PROVIDER_UNAVAILABLE');
    url.searchParams.set('dni', dni);
    let response: Response;
    try { response = await this.fetcher(url, { signal, redirect: 'error', headers: { Accept: 'application/json', Authorization: `Bearer ${this.token}` } }); }
    catch { throw new DniProviderError(signal?.aborted ? 'DNI_PROVIDER_TIMEOUT' : 'DNI_PROVIDER_UNAVAILABLE'); }
    if (response.status === 404) return null;
    if (response.status === 429) throw new DniProviderError('DNI_PROVIDER_RATE_LIMIT');
    if (response.status >= 500) throw new DniProviderError('DNI_PROVIDER_UNAVAILABLE');
    if (!response.ok) throw new DniProviderError('DNI_PROVIDER_INVALID_RESPONSE');
    // Limitar la respuesta antes de JSON.parse; no registrar ni reenviar el payload.
    try {
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No body');
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read(); if (done) break;
          size += value.byteLength;
          if (size > 16_384) { await reader.cancel(); throw new Error('Oversized'); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      const raw: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid object');
      // El adaptador de esta fase recibe el contrato canónico documentado.
      return { ...(raw as DniLookupResult), source: 'api' };
    } catch { throw new DniProviderError(signal?.aborted ? 'DNI_PROVIDER_TIMEOUT' : 'DNI_PROVIDER_INVALID_RESPONSE'); }
  }
}
export function createDniProvider(env: NodeJS.ProcessEnv = process.env): DniProvider {
  const kind = env.DNI_PROVIDER ?? (env.NODE_ENV === 'production' ? 'disabled' : 'mock');
  if (kind === 'mock' && env.NODE_ENV !== 'production') return new MockDniProvider();
  if (kind === 'api') return new ApiDniProvider(env.DNI_API_URL ?? '', env.DNI_API_TOKEN ?? '');
  return new UnavailableDniProvider();
}
