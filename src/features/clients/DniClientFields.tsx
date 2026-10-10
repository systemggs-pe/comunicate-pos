import { ValidatedInput } from '../../components/FormValidation';
import { ClientFields, emptyClient, type ClientFieldsValue } from './ClientFields';
import type { DniLookupState } from '../../hooks/useDniLookup';
import type { Client } from '../../types/pos';

export function DniClientFields({ value, onChange, lookup, onUse }: {
  value: ClientFieldsValue; onChange: (value: ClientFieldsValue) => void;
  lookup: DniLookupState; onUse?: (client: Client) => void;
}) {
  const local = lookup.localClient;
  return <div className="dni-client-fields">
    <label>DNI<ValidatedInput aria-label="DNI" name="dni" inputMode="numeric" autoComplete="off" maxLength={12} required value={value.dni} onChange={event => onChange({ ...emptyClient, dni: event.target.value })} /><span className="form-hint">8 dígitos. Primero buscamos el cliente existente.</span></label>
    {!!value.dni && !lookup.valid && <p className="form-hint">Completa ocho dígitos para consultar el DNI.</p>}
    {lookup.loading && <div className="dni-notice" role="status"><p>Consultando DNI...</p><button type="button" className="text-button" onClick={lookup.useManual}>Ingresar datos manualmente</button></div>}
    {local ? <><ClientFields showDni={false} readOnly value={{...value,firstName:local.firstName,lastName:local.lastName,phone:local.phone??'',email:local.email??'',address:local.address??'',department:local.department??''}} onChange={onChange}/><div className="lookup-result" role="status"><strong>Cliente encontrado</strong><p>{local.firstName} {local.lastName}</p><p>{local.code} · DNI {local.dni}</p><p>{local.phone || 'Sin celular'}{local.email ? ` · ${local.email}` : ''}</p>{onUse && <button type="button" className="secondary-button" onClick={() => onUse(local)}>Usar cliente</button>}</div></> : <>
      {lookup.data?.source === 'EXTERNAL' && <p className="dni-notice" role="status">Datos encontrados. Datos obtenidos mediante consulta DNI. Revisa y confirma antes de guardar.</p>}
      {(lookup.data?.source === 'NONE' || lookup.error) && <div className="dni-notice" role="status"><p>{lookup.data?.source === 'NONE' ? lookup.data.error.message : lookup.error?.message}</p><button type="button" className="text-button" onClick={lookup.retry}>Reintentar consulta DNI</button></div>}
      {lookup.manual && <p className="form-hint">Ingresa los datos manualmente y confirma para continuar.</p>}
      <ClientFields showDni={false} value={value} onChange={onChange} />
    </>}
  </div>;
}
