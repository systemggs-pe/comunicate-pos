import { useRef, useState } from 'react';
import { ZodError } from 'zod';
import { ApiError } from '../services/api';
export function useSubmit() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [code, setCode] = useState('');
  async function run<T>(operation: () => Promise<T>): Promise<T | undefined> {
    if (lock.current) return undefined;
    lock.current = true; setBusy(true); setError(''); setCode('');
    try { return await operation(); }
    catch (cause) { setError(cause instanceof ZodError ? cause.issues.map(i => i.message).join(' ') : cause instanceof Error ? cause.message : 'No se pudo completar la operación.'); setCode(cause instanceof ApiError ? cause.code : 'VALIDATION_ERROR'); return undefined; }
    finally { lock.current = false; setBusy(false); }
  }
  return { busy, error, code, run };
}
