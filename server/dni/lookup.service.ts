import { z } from 'zod';
import {normalizeText} from '../../shared/normalization.js';
import { dniSchema } from '../../shared/validation.js';
import type { DniData, DniLookupResponse } from '../../shared/dni.js';
import { DomainError } from '../lib/errors.js';
import { dniError, DniProviderError, type DniLookupResult, type DniProvider } from './provider.js';

const name = z.string().trim().transform(value => value.replace(/\s+/g, ' ')).pipe(z.string().min(1).max(100));
function normalize(raw: DniLookupResult, dni: string): DniData {
  if(raw.source==='codart'&&raw.dni===dni&&typeof raw.fullName==='string'&&raw.fullName.trim()&&raw.fullName.length<=201)return {dni,fullName:normalizeText(raw.fullName),firstName:'',lastName:''};
  const parsedDni = dniSchema.safeParse(raw.dni);
  const first = name.safeParse(raw.firstName);
  const last = name.safeParse(raw.lastName ?? [raw.paternalLastName, raw.maternalLastName].filter(Boolean).join(' '));
  if (!parsedDni.success || parsedDni.data !== dni || !first.success || !last.success) throw new DniProviderError('DNI_PROVIDER_INVALID_RESPONSE');
  return { dni, firstName: first.data, lastName: last.data };
}
export interface DniLookupOptions { timeoutMs?: number; cacheTtlMs?: number; backoffMs?: number; maxCacheEntries?: number; now?: () => number }
export function createDniLookupService<TClient>(findLocal: (dni: string) => Promise<TClient | null>, provider: DniProvider, options: DniLookupOptions = {}) {
  const timeoutMs = options.timeoutMs ?? 4000, ttl = options.cacheTtlMs ?? 60000, backoff = options.backoffMs ?? 150;
  const now = options.now ?? Date.now, maxEntries = options.maxCacheEntries ?? 512;
  type External = Exclude<DniLookupResponse<TClient>, { source: 'LOCAL' }>;
  const cache = new Map<string, { expires: number; result: External }>();
  const inflight = new Map<string, Promise<External>>();
  async function external(dni: string): Promise<External> {
    const deadline = Date.now() + timeoutMs;
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const remaining = Math.max(1, deadline - Date.now());
      const budget = attempt === 0 ? Math.max(1, Math.floor((remaining - backoff) / 2)) : remaining;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const raw = await Promise.race([
          Promise.resolve().then(() => provider.lookup(dni, controller.signal)),
          new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { controller.abort(); reject(new DniProviderError('DNI_PROVIDER_TIMEOUT')); }, budget); }),
        ]);
        return raw ? { source: 'EXTERNAL', data: normalize(raw, dni) } : { source: 'NONE', error: dniError('DNI_NOT_FOUND') };
      } catch (error) {
        const safe = error instanceof DniProviderError ? error : new DniProviderError('DNI_PROVIDER_UNAVAILABLE');
        if (attempt === 0 && ['DNI_PROVIDER_UNAVAILABLE', 'DNI_PROVIDER_TIMEOUT', 'DNI_PROVIDER_RATE_LIMIT'].includes(safe.code) && Date.now() + backoff < deadline) {
          await new Promise(resolve => setTimeout(resolve, backoff));
        } else return { source: 'NONE', error: dniError(safe.code) };
      } finally { if (timer) clearTimeout(timer); controller.abort(); }
    }
    return { source: 'NONE', error: dniError('DNI_PROVIDER_UNAVAILABLE') };
  }
  return {
    async lookup(rawDni: unknown): Promise<DniLookupResponse<TClient>> {
      const parsed = dniSchema.safeParse(rawDni);
      if (!parsed.success) throw new DomainError(400, dniError('DNI_INVALID').message, 'DNI_INVALID');
      const dni = parsed.data;
      const local = await findLocal(dni); if (local) return { source: 'LOCAL', client: local };
      for (const [key, value] of cache) if (value.expires <= now()) cache.delete(key);
      let result = cache.get(dni)?.result;
      if (!result) {
        let request = inflight.get(dni);
        if (!request) {
          request = external(dni).then(value => {
            if (value.source === 'EXTERNAL' || value.error.code === 'DNI_NOT_FOUND') {
              if (cache.size >= maxEntries) cache.delete(cache.keys().next().value!);
              cache.set(dni, { expires: now() + ttl, result: value });
            }
            return value;
          }).finally(() => inflight.delete(dni));
          inflight.set(dni, request);
        }
        result = await request;
      }
      // Una creación concurrente gana incluso si el proveedor ya respondió/caché existe.
      const current = await findLocal(dni);
      return current ? { source: 'LOCAL', client: current } : result;
    },
  };
}
export function dniLookupOptions(env: NodeJS.ProcessEnv = process.env): DniLookupOptions {
  const bounded = (value: string | undefined, fallback: number, min: number, max: number) => {
    const number = Number(value); return value && Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  };
  return { timeoutMs: bounded(env.DNI_TIMEOUT_MS, 4000, 100, 10000), cacheTtlMs: bounded(env.DNI_CACHE_TTL_MS, 60000, 0, 60000) };
}
