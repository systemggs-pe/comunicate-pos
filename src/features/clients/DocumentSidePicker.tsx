import {useState} from 'react';
import {useAuth} from '../../app/AuthProvider';
import {ErrorNotice} from '../../components/common';
import type {ClientDocumentView} from '../../../shared/client-documents';
export const identitySideLabel=(category:string)=>category==='DNI_FRONT'?'Anverso':category==='DNI_BACK'?'Reverso':'Sin lado asignado';
export function DocumentSidePicker({clientId,document,onSaved}:{clientId:string;document:ClientDocumentView;onSaved:(category:'DNI_FRONT'|'DNI_BACK')=>void}){
 const {api,can}=useAuth(),[side,setSide]=useState<'DNI_FRONT'|'DNI_BACK'|''>(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(document.category!=='IDENTITY_IMAGE')return null;
 if(!can('client.documents.replace'))return <p>Pide al administrador que identifique el lado.</p>;
 async function save(){if(!side||busy)return;setBusy(true);setError('');try{const result=await api.patch<{category:'DNI_FRONT'|'DNI_BACK'}>(`/clients/${clientId}/documents/${document.id}/side`,{category:side,confirm:true});onSaved(result.category);}catch(e){setError(e instanceof Error?e.message:'No se pudo guardar el lado.');}finally{setBusy(false);}}
 return <div className="document-side-picker"><label>¿Qué lado es?<select aria-label={`Lado de la imagen ${document.sourceOrdinal??document.id}`} value={side} disabled={busy} onChange={e=>setSide(e.target.value as typeof side)}><option value="">Seleccionar lado</option><option value="DNI_FRONT">Anverso (adelante)</option><option value="DNI_BACK">Reverso (atrás)</option></select></label><button type="button" className="secondary-button" disabled={!side||busy} onClick={()=>void save()}>{busy?'Guardando...':'Guardar lado'}</button><ErrorNotice message={error}/></div>;
}
