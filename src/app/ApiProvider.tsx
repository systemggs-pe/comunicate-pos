import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { ApiClient } from '../services/api';
interface AccessContext { api: ApiClient; connected: boolean; connect: (token: string) => Promise<void>; disconnect: () => void }
const Context = createContext<AccessContext | null>(null);
export function ApiProvider({ children }: { children: ReactNode }) {
  // TEMPORARY AUTH: sólo memoria. Nunca persistir token o datos comerciales en el navegador.
  const [token, setToken] = useState('');
  const api = useMemo(() => new ApiClient(token), [token]);
  async function connect(value: string) { await new ApiClient(value).get('/access'); setToken(value); }
  return <Context.Provider value={{ api, connected: token.length > 0, connect, disconnect: () => setToken('') }}>{children}</Context.Provider>;
}
export function useApi() { const context = useContext(Context); if (!context) throw new Error('ApiProvider requerido'); return context; }
