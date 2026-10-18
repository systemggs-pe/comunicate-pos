import {DniPhotoType,DniPhotoGrid,DniPhotoLoading,DniPhotoNotice,photoErrorMessage} from './DniPhotoUI';
import {Search,LoaderCircle} from 'lucide-react';
import {useState} from 'react';
import {useAuth} from '../../app/AuthProvider';
import {useApiQuery} from '../../hooks/useApiQuery';
import {type ClientDocumentView} from '../../../shared/client-documents';
import './documents.css';
export const typeLabels:Record<string,string>={BLUE:'DNI AZUL',ELECTRONIC:'DNI ELECTRÓNICO',MANUAL:'CARGA MANUAL'};
export const sourceLabels:Record<string,string>={MANUAL_UPLOAD:'CARGA MANUAL',CODART_DNIV:'CODART · DNI AZUL',CODART_DNIVEL:'CODART · DNI ELECTRÓNICO',REGISTRATION_EVIDENCE:'REGISTRO ANTERIOR'};
export const categoryLabels:Record<string,string>={DNI_FRONT:'DNI FRONTAL',DNI_BACK:'DNI REVERSO',IDENTITY_IMAGE:'IMAGEN SIN IDENTIFICAR',DEVICE_BOX:'CAJA',PURCHASE_RECEIPT:'BOLETA DE COMPRA',LOGICAL_IMEI:'IMEI LÓGICO'};
export function CodartPhotoConsent({confirmed,onConfirmed,disabled=false}:{confirmed:boolean;onConfirmed:(value:boolean)=>void;disabled?:boolean}){
 return <label className="checkbox-label dni-photo-consent"><input type="checkbox" checked={confirmed} disabled={disabled} onChange={e=>onConfirmed(e.target.checked)}/><span>Tengo permiso para consultar y guardar estas fotos del DNI.</span></label>;
}
export function DocumentAuthorizationFields({purpose,onPurpose,reference,onReference,confirmed,onConfirmed}:{purpose:string;onPurpose:(v:string)=>void;reference:string;onReference:(v:string)=>void;confirmed:boolean;onConfirmed:(v:boolean)=>void}){
 return <><div className="form-grid"><label>FINALIDAD DOCUMENTAL<input aria-label="Finalidad documental" maxLength={200} value={purpose} onChange={e=>onPurpose(e.target.value)}/></label><label>REFERENCIA DE AUTORIZACIÓN<input aria-label="Referencia de autorización" maxLength={200} value={reference} onChange={e=>onReference(e.target.value)}/></label></div><label className="checkbox-label"><input type="checkbox" checked={confirmed} onChange={e=>onConfirmed(e.target.checked)}/>CONFIRMO AUTORIZACIÓN PARA CONSULTA, CONSERVACIÓN Y REUTILIZACIÓN DOCUMENTAL</label></>;
}
export function IdentityPhotoLookup({clientId,onChanged,showDocuments=true}:{clientId:string;onChanged?:()=>void;showDocuments?:boolean}){
 const {api,can}=useAuth(),allowed=can('client.documents.read'),query=useApiQuery<{documents:ClientDocumentView[]}>(allowed?`/clients/${clientId}/documents`:null);
 const [type,setType]=useState<'BLUE'|'ELECTRONIC'>('BLUE'),[confirmed,setConfirmed]=useState(false),[refresh,setRefresh]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const documents=query.data?.documents.filter(d=>d.documentType===type&&d.status==='CURRENT'&&!d.retentionDue)??[];
 async function lookup(){setError('');try{setBusy(true);const result=await api.post<{reused:boolean;creditsDeducted:number|null;simulated?:boolean}>(`/clients/${clientId}/identity-photos`,{confirmed,documentType:type,refresh});setNotice(result.simulated?'Estas fotos son de demostración.':result.reused?'Mostramos las fotos que ya estaban guardadas.':`Fotos guardadas.${result.creditsDeducted===null?'':` Créditos usados: ${result.creditsDeducted}.`}`);setRefresh(false);query.refresh();onChanged?.();}catch(e){setError(photoErrorMessage(e));}finally{setBusy(false);}}
 if(!allowed)return <p>No tienes permiso para ver estas fotos.</p>;
 const canRequest=can('client.identity_photo.lookup')&&can('client.documents.upload');
 return <section className="identity-photo-panel dni-photo-workspace" aria-label="Fotos del DNI"><div className="dni-photo-intro"><h3>Fotos del DNI</h3><p>Consulta el anverso y el reverso.</p></div><DniPhotoType value={type} disabled={busy} onChange={value=>{setType(value);setConfirmed(false);setRefresh(false);setNotice('');setError('');}}/><p className="dni-photo-help">Primero usamos las fotos guardadas. Pedir fotos a CODART puede usar créditos.</p>
 {canRequest&&<>{can('client.documents.replace')&&documents.length>0&&<details className="dni-photo-extra"><summary>Necesito fotos nuevas</summary><label className="checkbox-label"><input type="checkbox" checked={refresh} disabled={busy} onChange={e=>{setRefresh(e.target.checked);setConfirmed(false);}}/>Pedir otras fotos a CODART (puede usar créditos).</label></details>}{(!documents.length||refresh)&&<div className="dni-photo-request"><CodartPhotoConsent confirmed={confirmed} onConfirmed={setConfirmed} disabled={busy}/><button type="button" className="primary-button dni-photo-search" disabled={busy||query.loading||!confirmed} onClick={()=>void lookup()}>{busy?<LoaderCircle className="dni-photo-spinner" size={17} aria-hidden="true"/>:<Search size={17} aria-hidden="true"/>}{busy?'Buscando…':'Buscar fotos'}</button></div>}</>}
 <DniPhotoNotice message={notice}/>{error&&<p className="dni-photo-error" role="alert">{error}</p>}{query.error&&<p className="dni-photo-error" role="alert">{photoErrorMessage(query.error)}</p>}{busy||query.loading?<DniPhotoLoading/>:showDocuments&&documents.length>0?<DniPhotoGrid clientId={clientId} documents={documents} onSideSaved={()=>{query.refresh();onChanged?.();}}/>:!documents.length&&!error&&!query.error&&<p className="dni-photo-small-empty">Aún no hay fotos guardadas de este tipo.</p>}
 </section>;
}
