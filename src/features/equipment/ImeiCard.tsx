import { useState } from 'react';
import { useApi } from '../../app/ApiProvider';
import { useSubmit } from '../../hooks/useSubmit';
import { registrationSchema } from '../../../shared/validation';
import type { Equipment, Imei, RegistrationStatus } from '../../types/pos';
import { ErrorNotice, formatDate, StatusBadge, statusLabels } from '../../components/common';

export const registrationStatuses: RegistrationStatus[] = ['NOT_REGISTERED', 'PENDING', 'PROCESSING', 'REGISTERED', 'REJECTED', 'CANCELLED'];
export function RegistrationFields({ status, method, onStatus, onMethod }: { status: RegistrationStatus; method: string; onStatus: (value: RegistrationStatus) => void; onMethod: (value: string) => void }) {
  return <div className="form-grid"><label>Estado de registro<select value={status} onChange={e => onStatus(e.target.value as RegistrationStatus)}>{registrationStatuses.map(value => <option value={value} key={value}>{statusLabels[value]}</option>)}</select></label><label>Método de registro <span className="optional">opcional</span><input name="registrationMethod" maxLength={100} placeholder="Ej. Movistar, Bitel, otro" value={method} onChange={e => onMethod(e.target.value)} /></label></div>;
}
export function ImeiCard({ imei, equipment, onSaved }: { imei: Imei; equipment: Equipment; onSaved: () => void }) {
  const { api } = useApi(); const submit = useSubmit();
  const [editing, setEditing] = useState(false), [status, setStatus] = useState(imei.registrationStatus), [method, setMethod] = useState(imei.registrationMethod ?? '');
  return <article className="imei-card" data-testid={`imei-card-${imei.slot}`} id={`imei-${imei.id}`}>
    <div className="section-heading"><h3>IMEI {imei.slot}</h3><StatusBadge status={imei.registrationStatus} /></div>
    <p className="imei-value">{imei.value}</p><p className="muted">{statusLabels[imei.type]}{imei.registrationMethod ? ` · ${imei.registrationMethod}` : ''}</p>
    {imei.registeredAt && <p className="form-hint">Registrado: {formatDate(imei.registeredAt)}</p>}
    {!editing ? <button className="secondary-button" disabled={!equipment.ownerId} onClick={() => setEditing(true)}>Actualizar IMEI {imei.slot}</button> : <form onSubmit={async event => {
      event.preventDefault(); const result = await submit.run(() => api.patch<Equipment>(`/imeis/${imei.value}/registration`, registrationSchema.parse({ status, method: method.trim() || null, ownerId: equipment.ownerId })));
      if (result) { setEditing(false); onSaved(); }
    }}><RegistrationFields status={status} method={method} onStatus={setStatus} onMethod={setMethod} /><ErrorNotice message={submit.error} /><div className="form-actions"><button className="primary-button" disabled={submit.busy}>{submit.busy ? 'Guardando...' : `Guardar IMEI ${imei.slot}`}</button><button className="text-button" type="button" disabled={submit.busy} onClick={() => setEditing(false)}>Cancelar</button></div></form>}
    {!equipment.ownerId && <p className="form-hint">Este equipo necesita un propietario antes de registrar sus IMEIs.</p>}
  </article>;
}
