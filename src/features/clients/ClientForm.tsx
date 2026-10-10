import { useState } from 'react';
import { useApi } from '../../app/ApiProvider';
import { Link } from '../../app/router';
import { useSubmit } from '../../hooks/useSubmit';
import { clientEditSchema, clientSchema } from '../../../shared/validation';
import type { Client } from '../../types/pos';
import { ErrorNotice } from '../../components/common';
import { ClientFields, emptyClient, asClientInput, type ClientFieldsValue } from './ClientFields';
import { DniClientFields } from './DniClientFields';
import { useDniLookup } from '../../hooks/useDniLookup';
export { ClientFields, emptyClient, asClientInput, type ClientFieldsValue } from './ClientFields';
export function ClientForm({ initial, onSaved, onCancel }: { initial?: Client; onSaved: (client: Client) => void; onCancel?: () => void }) {
  const { api } = useApi();
  const [value, setValue] = useState<ClientFieldsValue>(initial ? { dni: initial.dni, firstName: initial.firstName, lastName: initial.lastName, phone: initial.phone ?? '', email: initial.email ?? '',address:initial.address??'',department:initial.department??'' } : emptyClient);
  const lookup = useDniLookup(initial ? emptyClient : value, setValue);
  const [duplicate, setDuplicate] = useState<Client | null>(null); const submit = useSubmit();
  return <form className="form-panel" onSubmit={async event => {
    event.preventDefault();
    const result = await submit.run(async () => {
      setDuplicate(null);
      if (!initial && lookup.loading) throw new Error('Espera la consulta DNI o elige ingreso manual.');
      if (!initial && lookup.localClient) return lookup.localClient;
      const input = initial ? clientEditSchema.parse({ firstName: value.firstName, lastName: value.lastName, phone: value.phone.trim() || null, email: value.email.trim() || null }) : clientSchema.parse(asClientInput(value));
      try { return initial ? await api.patch<Client>(`/clients/${initial.id}`, input) : await api.post<Client>('/clients', input); }
      catch (error) { if (!initial) { const found = await api.get<Client>(`/clients/by-dni/${encodeURIComponent(value.dni.replace(/\s/g, ''))}`).catch(() => null); setDuplicate(found); } throw error; }
    });
    if (result) onSaved(result);
  }}><fieldset disabled={submit.busy}>{initial ? <ClientFields value={value} onChange={setValue} readOnlyDni /> : <DniClientFields value={value} onChange={setValue} lookup={lookup} />}<ErrorNotice message={submit.error} />{duplicate && <Link className="inline-link" to={`/clientes/${duplicate.id}`}>Abrir cliente existente {duplicate.code}</Link>}<div className="form-actions"><button className="primary-button" disabled={submit.busy || (!initial && lookup.loading)}>{submit.busy ? 'Guardando...' : initial ? 'Guardar cliente' : lookup.localClient ? 'Usar cliente' : 'Crear cliente'}</button>{onCancel && <button type="button" className="secondary-button" disabled={submit.busy} onClick={onCancel}>Cancelar</button>}</div></fieldset></form>;
}
