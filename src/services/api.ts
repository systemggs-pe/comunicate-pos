export async function getApiHealth(signal?: AbortSignal): Promise<boolean> {
  const response = await fetch('/api/health', { signal });
  if (!response.ok) throw new Error('API no disponible');
  const data: unknown = await response.json();
  return typeof data === 'object' && data !== null && 'status' in data && data.status === 'ok';
}
