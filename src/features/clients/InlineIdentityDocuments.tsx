import {useState} from 'react';
import {useAuth} from '../../app/AuthProvider';
import {clientSchema} from '../../../shared/validation';
import {asClientInput,type ClientFieldsValue} from './ClientFields';
import {IdentityPhotoLookup} from './IdentityPhotoLookup';
import type {DniLookupState} from '../../hooks/useDniLookup';
import type {Client} from '../../types/pos';
export function InlineIdentityDocuments({value,lookup}:{value:ClientFieldsValue;lookup:DniLookupState}){
 const {api,can}=useAuth(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(!can('client.documents.read'))return null;
 if(lookup.localClient)return <IdentityPhotoLookup key={lookup.localClient.id} clientId={lookup.localClient.id}/>;
 if(!lookup.valid)return null;
 async function save(){try{setError('');const input=clientSchema.parse(asClientInput(value));setBusy(true);await api.post<Client>('/clients',input);lookup.retry();}catch(e){setError(e instanceof Error?e.message:'NO SE PUDO GUARDAR EL CLIENTE.');}finally{setBusy(false);}}
 return <section className="identity-photo-panel"><h3>DOCUMENTACIÓN DEL CLIENTE</h3><p>Para asociar fotografías, guarda primero los datos del cliente. El equipo y la operación se confirman al finalizar su formulario.</p>{can('clients.create')&&<button className="secondary-button" type="button" disabled={busy||lookup.loading} onClick={()=>void save()}>{busy?'GUARDANDO CLIENTE...':'GUARDAR CLIENTE PARA DOCUMENTACIÓN'}</button>}{error&&<p role="alert">{error}</p>}</section>;
}
