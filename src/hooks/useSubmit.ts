import { useRef, useState, type RefObject } from 'react';
import { ZodError } from 'zod';
import { ApiError } from '../services/api';
export function useSubmit(form?:RefObject<HTMLFormElement|null>) {
  const lock = useRef(false); const [fields,setFields]=useState<Record<string,string>>({});
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [code, setCode] = useState('');
  async function run<T>(operation: () => Promise<T>): Promise<T | undefined> {
    if (lock.current) return undefined;
    lock.current = true; setBusy(true); setError(''); setCode(''); setFields({});
    try { return await operation(); }
    catch (cause) { if(cause instanceof ZodError){const errors:Record<string,string>={};for(const issue of cause.issues)errors[issue.path.join('.')]=issue.message;setFields(errors);requestAnimationFrame(()=>{for(const path of Object.keys(errors)){const field=form?.current?.elements.namedItem(path);if(field instanceof HTMLElement){field.focus();break;}}});} setError(cause instanceof ZodError ? cause.issues.map(i => i.message).join(' ') : cause instanceof Error ? cause.message : 'No se pudo completar la operación.'); setCode(cause instanceof ApiError ? cause.code : 'VALIDATION_ERROR'); return undefined; }
    finally { lock.current = false; setBusy(false); }
  }
  return { busy, error, code, fields, run };
}
