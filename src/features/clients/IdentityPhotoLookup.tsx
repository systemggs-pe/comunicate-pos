import {useState} from 'react';
import {useAuth} from '../../app/AuthProvider';
import {useApiQuery} from '../../hooks/useApiQuery';
import {documentAuthorization,type ClientDocumentView} from '../../../shared/client-documents';
import {DocumentImage} from './DocumentImage';
import './documents.css';
export const typeLabels:Record<string,string>={BLUE:'DNI AZUL',ELECTRONIC:'DNI ELECTRÓNICO',MANUAL:'CARGA MANUAL'};
export const categoryLabels:Record<string,string>={DNI_FRONT:'DNI FRONTAL',DNI_BACK:'DNI REVERSO',IDENTITY_IMAGE:'IMAGEN SIN IDENTIFICAR',DEVICE_BOX:'CAJA',PURCHASE_RECEIPT:'BOLETA DE COMPRA',LOGICAL_IMEI:'IMEI LÓGICO'};
export function DocumentAuthorizationFields({purpose,onPurpose,reference,onReference,confirmed,onConfirmed}:{purpose:string;onPurpose:(v:string)=>void;reference:string;onReference:(v:string)=>void;confirmed:boolean;onConfirmed:(v:boolean)=>void}){
 return <><div className="form-grid"><label>FINALIDAD DOCUMENTAL<input aria-label="Finalidad documental" maxLength={200} value={purpose} onChange={e=>onPurpose(e.target.value)}/></label><label>REFERENCIA DE AUTORIZACIÓN<input aria-label="Referencia de autorización" maxLength={200} value={reference} onChange={e=>onReference(e.target.value)}/></label></div><label className="checkbox-label"><input type="checkbox" checked={confirmed} onChange={e=>onConfirmed(e.target.checked)}/>CONFIRMO AUTORIZACIÓN PARA CONSULTA, CONSERVACIÓN Y REUTILIZACIÓN DOCUMENTAL</label></>;
}
export function IdentityPhotoLookup({clientId,onChanged}:{clientId:string;onChanged?:()=>void}){
 const {api,can}=useAuth(),allowed=can('client.documents.read'),query=useApiQuery<{documents:ClientDocumentView[]}>(allowed?`/clients/${clientId}/documents`:null);
 const [type,setType]=useState<'BLUE'|'ELECTRONIC'>('BLUE'),[purpose,setPurpose]=useState('REGISTRO DE EQUIPO'),[reference,setReference]=useState(''),[confirmed,setConfirmed]=useState(false),[refresh,setRefresh]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const documents=query.data?.documents.filter(d=>d.documentType===type&&d.status==='CURRENT'&&!d.retentionDue)??[];
 async function lookup(){setError('');try{const authorization=documentAuthorization.parse({purpose,authorizationReference:reference,confirmed});setBusy(true);const result=await api.post<{reused:boolean;creditsDeducted:number|null;simulated?:boolean}>(`/clients/${clientId}/identity-photos`,{...authorization,documentType:type,refresh});setNotice(`${result.simulated?'PROVEEDOR SIMULADO DE PRUEBAS. ':''}${result.reused?'FOTOGRAFÍAS RECUPERADAS DEL EXPEDIENTE.':`FOTOGRAFÍAS GUARDADAS. CRÉDITOS: ${result.creditsDeducted===null?'NO INFORMADOS POR EL PROVEEDOR':result.creditsDeducted}`}`);setRefresh(false);query.refresh();onChanged?.();}catch(e){setError(e instanceof Error?e.message:'NO SE PUDO OBTENER LA FOTO.');}finally{setBusy(false);}}
 if(!allowed)return <p>Tu rol no tiene permiso para consultar documentación.</p>;
 return <section className="identity-photo-panel"><h3>FOTOGRAFÍAS DE IDENTIDAD</h3><label>TIPO DE DNI<select aria-label="Tipo de DNI" value={type} disabled={busy} onChange={e=>{setType(e.target.value as typeof type);setNotice('');}}><option value="BLUE">DNI AZUL</option><option value="ELECTRONIC">DNI ELECTRÓNICO</option></select></label>
  <p className="form-hint">Se recuperan primero las fotografías guardadas de este tipo. Una consulta externa puede consumir créditos; no se presume gratuita.</p>
  {can('client.identity_photo.lookup')&&can('client.documents.upload')&&<><DocumentAuthorizationFields purpose={purpose} onPurpose={setPurpose} reference={reference} onReference={setReference} confirmed={confirmed} onConfirmed={setConfirmed}/>{can('client.documents.replace')&&documents.length>0&&<label className="checkbox-label"><input type="checkbox" checked={refresh} onChange={e=>setRefresh(e.target.checked)}/>ACTUALIZAR FOTOGRAFÍAS CON CONSULTA EXTERNA AUTORIZADA</label>}<button type="button" className="primary-button" disabled={busy||!confirmed} onClick={()=>void lookup()}>{busy?'OBTENIENDO FOTOS...':'OBTENER FOTO DNI'}</button></>}
  {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}{query.error&&<p role="alert">{query.error.message}</p>}
  <div className="document-grid">{documents.map(d=><article className="document-card" key={d.id}><h4>{d.category==='IDENTITY_IMAGE'?`IMAGEN ${d.sourceOrdinal??1}`:categoryLabels[d.category]}</h4><p>{typeLabels[d.documentType]} · {d.source}</p><DocumentImage path={`/clients/${clientId}/documents/${d.id}/access`} label={`Documento de identidad ${d.sourceOrdinal??d.category}`}/>{d.category==='IDENTITY_IMAGE'&&<p>Identifica anverso o reverso en DOCUMENTACIÓN antes de reutilizar.</p>}</article>)}</div>
 </section>;
}
