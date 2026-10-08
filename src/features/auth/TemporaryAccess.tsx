import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useApi } from '../../app/ApiProvider';
import { useSubmit } from '../../hooks/useSubmit';
import { ErrorNotice } from '../../components/common';
export function TemporaryAccess() {
  const { connect } = useApi(); const [key, setKey] = useState(''); const submit = useSubmit();
  return <section className="access-panel"><KeyRound size={28} aria-hidden="true" /><h1>Acceso temporal</h1><p>Ingresa la clave temporal del sistema para trabajar con clientes y equipos.</p><form onSubmit={async event => {
    event.preventDefault(); const result = await submit.run(async () => { await connect(key); return true; }); if (result) setKey('');
  }}><label htmlFor="access-key">Clave temporal</label><input id="access-key" type="password" autoComplete="off" required value={key} onChange={e => setKey(e.target.value)} /><ErrorNotice message={submit.error} /><button className="primary-button" disabled={submit.busy}>{submit.busy ? 'Conectando...' : 'Conectar acceso'}</button></form><p className="form-hint">El acceso se cierra al recargar o cerrar esta pestaña.</p></section>;
}
