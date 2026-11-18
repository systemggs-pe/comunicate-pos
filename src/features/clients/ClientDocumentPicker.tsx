import {CheckCircle2,RefreshCw} from 'lucide-react';
import {useEffect,useMemo} from 'react';
import {useAuth} from '../../app/AuthProvider';
import {selectIdentityDocuments} from '../../../shared/identity-selection';
import {useApiQuery} from '../../hooks/useApiQuery';
import type {VaultData} from './DocumentVault';
import type {ClientDocumentView} from '../../../shared/client-documents';
import {DocumentImage} from './DocumentImage';
export interface RegistrationIdentityState {clientId:string|null;ids:string[];categories:string[];current?:ClientDocumentView[];loading:boolean;error:string}
export function ClientDocumentPicker({clientId,onChange,replacedSides=[]}:{clientId:string|null;onChange:(state:RegistrationIdentityState)=>void;replacedSides?:string[]}){
 const {can}=useAuth(),allowed=can('client.documents.read')&&can('registration.evidence.upload'),query=useApiQuery<VaultData>(clientId&&allowed?`/clients/${clientId}/documents`:null);
 const current=useMemo(()=>query.data?.documents.filter(d=>d.status==='CURRENT'&&!d.retentionDue&&['DNI_FRONT','DNI_BACK'].includes(d.category))??[],[query.data]);
 const documents=useMemo(()=>selectIdentityDocuments(current),[current]);
 useEffect(()=>{onChange({clientId,ids:documents.map(d=>d.id),categories:documents.map(d=>d.category),current,loading:query.loading,error:query.error?.message??''});},[clientId,documents,current,query.loading,query.error,onChange]);
 if(!clientId||!allowed)return null;
 const reused=documents.filter(doc=>!replacedSides.includes(doc.category));
 return <div className="registration-dni-saved">{query.loading?<p role="status">Buscando el DNI guardado…</p>:query.error?<p role="alert">No se pudo revisar el DNI. <button type="button" className="text-button" onClick={query.refresh}><RefreshCw size={14} aria-hidden="true"/> Reintentar</button></p>:reused.length?<><p className="dni-saved-status"><CheckCircle2 size={16} aria-hidden="true"/>{reused.length===2?'DNI guardado · se adjuntará al registro':'Una foto del DNI guardada · se adjuntará al registro'}</p><div className="evidence-grid">{reused.map(d=><article key={d.id}><h3>{d.category==='DNI_FRONT'?'DNI frontal':'DNI posterior'}</h3><DocumentImage path={`/clients/${clientId}/documents/${d.id}/access`} label={d.category==='DNI_FRONT'?'DNI frontal':'DNI posterior'}/></article>)}</div></>:!documents.length&&<p>Este cliente aún no tiene fotos del DNI. Puedes agregarlas o continuar.</p>}</div>;
}
