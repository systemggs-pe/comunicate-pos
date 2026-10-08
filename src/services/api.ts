export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export class ApiClient {
  constructor(private token: string) {}
  async request<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`/api${path}`, {
        method, credentials: 'omit', signal: AbortSignal.any([AbortSignal.timeout(30000), ...(signal ? [signal] : [])]),
        headers: { Authorization: `Bearer ${this.token}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new ApiError(0, 'NETWORK_ERROR', 'No se pudo conectar. Compruebe la conexión y vuelva a intentar.');
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(response.status, data?.error?.code ?? 'REQUEST_FAILED', data?.error?.message ?? data?.message ?? 'No se pudo completar la operación.');
    if (method !== 'GET') window.dispatchEvent(new Event('pos:datachanged'));
    return data as T;
  }
  get<T>(path: string, signal?: AbortSignal) { return this.request<T>(path, 'GET', undefined, signal); }
  post<T>(path: string, body: unknown) { return this.request<T>(path, 'POST', body); }
  patch<T>(path: string, body: unknown) { return this.request<T>(path, 'PATCH', body); }
}
export async function getApiHealth(signal?: AbortSignal): Promise<boolean> {
  const response = await fetch('/api/health', { signal });
  if (!response.ok) throw new Error('API no disponible');
  const data: unknown = await response.json();
  return typeof data === 'object' && data !== null && 'status' in data && data.status === 'ok';
}
