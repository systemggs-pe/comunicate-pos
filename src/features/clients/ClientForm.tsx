import { useState } from 'react';
import { useApi } from '../../app/ApiProvider';
import { Link } from '../../app/router';
import { useSubmit } from '../../hooks/useSubmit';
import { clientEditSchema, clientSchema } from '../../../shared/validation';
import type { Client, ClientInput } from '../../types/pos';
import { ErrorNotice } from '../../components/common';
export interface ClientFieldsValue { dni: string; firstName: string; lastName: string; phone: string; email: string }
export const emptyClient: ClientFieldsValue = { dni: '', firstName: '', lastName: '', phone: '', email: '' };
export function asClientInput(value: ClientFieldsValue): ClientInput { return { dni: value.dni, firstName: value.firstName, lastName: value.lastName, phone: value.phone.trim() || undefined, email: value.email.trim() || undefined }; }
export function ClientFields({ value, onChange, showDni = true, readOnlyDni = false }: { value: ClientFieldsValue; onChange: (value: ClientFieldsValue) => void; showDni?: boolean; readOnlyDni?: boolean }) {
  return <div className="form-grid">
    {showDni && <label>DNI<input name="dni" inputMode="numeric" autoComplete="off" maxLength={12} required readOnly={readOnlyDni} value={value.dni} onChange={e => onChange({ ...value, dni: e.target.value })} /><span className="form-hint">8 dígitos{readOnlyDni ? ', no editable' : ''}.</span></label>}
    <label>Nombres<input name="firstName" autoComplete="given-name" maxLength={100} required value={value.firstName} onChange={e => onChange({ ...value, firstName: e.target.value })} /></label>
    <label>Apellidos<input name="lastName" autoComplete="family-name" maxLength={100} required value={value.lastName} onChange={e => onChange({ ...value, lastName: e.target.value })} /></label>
    <label>Celular <span className="optional">opcional</span><input name="phone" type="tel" autoComplete="tel" maxLength={30} value={value.phone} onChange={e => onChange({ ...value, phone: e.target.value })} /></label>
    <label>Correo <span className="optional">opcional</span><input name="email" type="email" autoComplete="email" maxLength={254} value={value.email} onChange={e => onChange({ ...value, email: e.target.value })} /></label>
  </div>;
}
export function ClientForm({ initial, onSaved, onCancel }: { initial?: Client; onSaved: (client: Client) => void; onCancel?: () => void }) {
  const { api } = useApi();
  const [value, setValue] = useState<ClientFieldsValue>(initial ? { dni: initial.dni, firstName: initial.firstName, lastName: initial.lastName, phone: initial.phone ?? '', email: initial.email ?? '' } : emptyClient);
  const [duplicate, setDuplicate] = useState<Client | null>(null); const submit = useSubmit();
  return <form className="form-panel" onSubmit={async event => {
    event.preventDefault();
    const result = await submit.run(async () => {
      setDuplicate(null);
      const input = initial ? clientEditSchema.parse({ firstName: value.firstName, lastName: value.lastName, phone: value.phone.trim() || null, email: value.email.trim() || null }) : clientSchema.parse(asClientInput(value));
      try { return initial ? await api.patch<Client>(`/clients/${initial.id}`, input) : await api.post<Client>('/clients', input); }
      catch (error) { if (!initial) { const found = await api.get<Client>(`/clients/by-dni/${encodeURIComponent(value.dni.replace(/\s/g, ''))}`).catch(() => null); setDuplicate(found); } throw error; }
    });
    if (result) onSaved(result);
  }}><ClientFields value={value} onChange={setValue} readOnlyDni={!!initial} /><ErrorNotice message={submit.error} />{duplicate && <Link className="inline-link" to={`/clientes/${duplicate.id}`}>Abrir cliente existente {duplicate.code}</Link>}<div className="form-actions"><button className="primary-button" disabled={submit.busy}>{submit.busy ? 'Guardando...' : initial ? 'Guardar cliente' : 'Crear cliente'}</button>{onCancel && <button type="button" className="secondary-button" disabled={submit.busy} onClick={onCancel}>Cancelar</button>}</div></form>;
}
