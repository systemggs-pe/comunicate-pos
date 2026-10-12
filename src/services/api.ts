import {apiBase} from '../../shared/cloud';
const base = apiBase(import.meta.env.VITE_API_BASE_URL, import.meta.env.PROD);
export const apiUrl = (path: string) => { if (!path.startsWith('/') || path.startsWith('//')) throw new Error('INVALID_API_PATH'); return `${base}${path}`; };
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export class ApiClient {
  async request<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
    let response: Response;
    try {
      response = await fetch(apiUrl(path), {
        method, credentials: 'include', signal: AbortSignal.any([AbortSignal.timeout(30000), ...(signal ? [signal] : [])]),
        headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new ApiError(0, 'NETWORK_ERROR', 'No se pudo conectar. Compruebe la conexión y vuelva a intentar.');
    }
    const data = await response.json().catch(() => null);
    if (response.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event('pos:unauthorized'));
    if (!response.ok) throw new ApiError(response.status, data?.error?.code ?? 'REQUEST_FAILED', data?.error?.message ?? data?.message ?? 'No se pudo completar la operación.');
    if (method !== 'GET') window.dispatchEvent(new Event('pos:datachanged'));
    return data as T;
  }
  get<T>(path: string, signal?: AbortSignal) { return this.request<T>(path, 'GET', undefined, signal); }
  post<T>(path: string, body: unknown) { return this.request<T>(path, 'POST', body); }
  patch<T>(path: string, body: unknown) { return this.request<T>(path, 'PATCH', body); }
}
export async function getApiHealth(signal?: AbortSignal): Promise<boolean> {
  const response = await fetch(apiUrl('/health'), { signal, credentials: 'include' });
  if (!response.ok) throw new Error('API no disponible');
  const data: unknown = await response.json();
  return typeof data === 'object' && data !== null && 'status' in data && data.status === 'ok';
}
