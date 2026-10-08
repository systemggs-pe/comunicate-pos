import { useEffect, useState } from 'react';
import { useApi } from '../app/ApiProvider';
import { ApiError } from '../services/api';
export function useApiQuery<T>(url: string | null) {
  const { api } = useApi();
  const [revision, setRevision] = useState(0);
  const key = `${url ?? ''}:${revision}`;
  const [result, setResult] = useState<{ key: string; data: T | null; error: ApiError | null }>({ key: '', data: null, error: null });
  useEffect(() => {
    if (url === null) return;
    const controller = new AbortController();
    api.get<T>(url, controller.signal).then(data => { if (!controller.signal.aborted) setResult({ key, data, error: null }); }).catch(error => {
      if (!controller.signal.aborted) setResult({ key, data: null, error: error instanceof ApiError ? error : new ApiError(0, 'REQUEST_FAILED', 'No se pudo cargar la información.') });
    });
    return () => controller.abort();
  }, [api, url, key]);
  const current = result.key === key;
  return { data: current ? result.data : null, error: current ? result.error : null, loading: url !== null && !current, refresh: () => setRevision(v => v + 1) };
}
