import { useState } from 'react';
import { useApi } from '../../app/ApiProvider';
import { Link } from '../../app/router';
import { useSubmit } from '../../hooks/useSubmit';
import { clientEditSchema, otherClientDocumentSchema, clientSchema } from '../../../shared/validation';
import type { Client } from '../../types/pos';
import { ErrorNotice } from '../../components/common';
import { ClientFields, emptyClient, asClientInput, type ClientFieldsValue } from './ClientFields';
import { DniClientFields } from './DniClientFields';
import { useDniLookup } from '../../hooks/useDniLookup';
export { ClientFields, emptyClient, asClientInput, type ClientFieldsValue } from './ClientFields';
export function ClientForm({ initial, onSaved, onCancel }: { initial?: Client; onSaved: (client: Client) => void; onCancel?: () => void }) {
  const { api } = useApi();
  const [value, setValue] = useState<ClientFieldsValue>(initial ? { dni: initial.dni??"",fullName:initial.fullName||(!initial.lastName?initial.firstName:undefined), firstName:initial.fullName||!initial.lastName?'':initial.firstName, lastName: initial.fullName||!initial.lastName?'':initial.lastName, phone: initial.phone ?? '', email: initial.email ?? '',address:initial.address??'',department:initial.department??'',province:initial.province??'' } : emptyClient);
  const [documentType,setDocumentType]=useState(initial?.documentType??'DNI');
  const [otherDocumentNumber,setOtherDocumentNumber]=useState(initial?.otherDocumentNumber??'');
  const other=documentType==='OTROS';
  const lookup = useDniLookup(initial||other ? emptyClient : value, setValue);
  const [duplicate, setDuplicate] = useState<Client | null>(null); const submit = useSubmit();
  return <form className="form-panel" onSubmit={async event => {
    event.preventDefault();
    const result = await submit.run(async () => {
      setDuplicate(null);
      if (!initial && !other && lookup.loading) throw new Error('Espera la consulta DNI o elige ingreso manual.');
      if (!initial && !other && lookup.localClient) return lookup.localClient;
      const {dni,...details}=asClientInput(value);
      const input = initial ? clientEditSchema.parse({fullName:value.fullName??null, firstName:value.fullName?'':value.firstName,lastName:value.fullName?'':value.lastName, phone: value.phone.trim() || null, email: value.email.trim() || null,address:value.address.trim()||null,department:value.department.trim()||null }) : other ? otherClientDocumentSchema.parse({...details,documentType,otherDocumentNumber}) : clientSchema.parse({...details,dni});
      try { return initial ? await api.patch<Client>(`/clients/${initial.id}`, input) : await api.post<Client>('/clients', input); }
      catch (error) { if (!initial && !other) { const found = await api.get<Client>(`/clients/by-dni/${encodeURIComponent(value.dni.replace(/\s/g, ''))}`).catch(() => null); setDuplicate(found); } throw error; }
    });
    if (result) onSaved(result);
  }}><fieldset disabled={submit.busy}>{!initial&&<label>Tipo de documento<select value={documentType} onChange={e=>{setDocumentType(e.target.value==='OTROS'?'OTROS':'DNI');setDuplicate(null);}}><option value="DNI">DNI</option><option value="OTROS">OTROS</option></select></label>}
    {other&&<label>{initial?'Documento (OTROS)':'Número de documento'}<input required maxLength={100} value={otherDocumentNumber} readOnly={!!initial} onChange={e=>setOtherDocumentNumber(e.target.value)}/></label>}
    {initial||other ? <ClientFields value={value} onChange={setValue} showDni={!other} readOnlyDni /> : <DniClientFields value={value} onChange={setValue} lookup={lookup} />}<ErrorNotice message={submit.error} />{duplicate && <Link className="inline-link" to={`/clientes/${duplicate.id}`}>Abrir cliente existente {duplicate.code}</Link>}<div className="form-actions"><button className="primary-button" disabled={submit.busy || (!initial && !other && lookup.loading)}>{submit.busy ? 'Guardando...' : initial ? 'Guardar cliente' : !other&&lookup.localClient ? 'Usar cliente' : 'Crear cliente'}</button>{onCancel && <button type="button" className="secondary-button" disabled={submit.busy} onClick={onCancel}>Cancelar</button>}</div></fieldset></form>;
}
