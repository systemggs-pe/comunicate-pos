import {useEffect,useRef,useState} from 'react';
import {useAuth} from '../../app/AuthProvider';
import {ErrorNotice} from '../../components/common';
import {CodartPhotoConsent} from '../clients/IdentityPhotoLookup';
import {DniPhotoType,photoErrorMessage,type PhotoDniType} from '../clients/DniPhotoUI';
import {DocumentImage} from '../clients/DocumentImage';
import {identitySideLabel} from '../clients/DocumentSidePicker';
import type {ClientDocumentView} from '../../../shared/client-documents';

export type DniSide='DNI_FRONT'|'DNI_BACK';
export type DniChoice={category:DniSide;documentId?:string;expectedIds:string[]};

export function RegistrationDniExtraction({clientId,current,choices,ready,onChoose,onRemove,ensureClient}:{
 clientId?:string;current:ClientDocumentView[];choices:DniChoice[];ready:boolean;
 onChoose:(choice:DniChoice)=>void;onRemove:(side:DniSide)=>void;ensureClient:()=>Promise<string>;
}){
 const {api,can}=useAuth();
 const [type,setType]=useState<PhotoDniType>('BLUE'),[confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [result,setResult]=useState<{clientId:string;documents:ClientDocumentView[]}|null>(null);
 const lookup=useRef<AbortController>(null);
 useEffect(()=>()=>lookup.current?.abort(),[]);
 if(!can('client.identity_photo.lookup')||!can('client.documents.upload')||!can('client.documents.read')||!can('registration.evidence.upload'))return null;

 async function extract(){
  setBusy(true);setError('');
  const controller=new AbortController();lookup.current=controller;
  try{
   const id=clientId??await ensureClient();
   if(controller.signal.aborted)return;
   const response=await api.request<{documents:ClientDocumentView[]}>(`/clients/${id}/identity-photos`,'POST',{documentType:type,confirmed,reviewOnly:true},controller.signal);
   setResult({clientId:id,documents:response.documents});
  }catch(error){if(!controller.signal.aborted)setError(photoErrorMessage(error));}
  finally{if(!controller.signal.aborted)setBusy(false);}
 }

 return <div className="identity-photo-panel dni-photo-workspace">
  <DniPhotoType value={type} disabled={busy} onChange={setType}/>
  <div className="dni-photo-request">
   {!clientId&&<p className="form-hint">Al solicitar fotos, se guardará primero la ficha del cliente para vincularlas a su DNI.</p>}
   <CodartPhotoConsent confirmed={confirmed} onConfirmed={setConfirmed} disabled={busy}/>
   <button type="button" className="secondary-button" disabled={busy||!confirmed} onClick={()=>void extract()}>{busy?'Extrayendo fotos…':error?'Reintentar extracción desde CODART':'Extraer fotos del DNI desde CODART'}</button>
  </div>
  <ErrorNotice message={error}/>
  {choices.filter(choice=>choice.documentId).map(choice=><p key={choice.category} className="form-hint">
   {identitySideLabel(choice.category)} de CODART seleccionado para este registro.
   <button type="button" className="text-button" onClick={()=>onRemove(choice.category)}>Quitar {identitySideLabel(choice.category).toLowerCase()}</button>
  </p>)}
  {result&&<div className="document-grid dni-photo-results">{result.documents.map(document=><article className="dni-photo-card" key={document.id}>
   <h3>{document.category==='IDENTITY_IMAGE'&&document.sourceOrdinal?`Foto ${document.sourceOrdinal} · sin lado asignado`:identitySideLabel(document.category)}</h3>
   <DocumentImage path={`/clients/${result.clientId}/documents/${document.id}/access`} label={identitySideLabel(document.category)}/>
   <div className="evidence-actions">{(['DNI_FRONT','DNI_BACK'] as const).filter(side=>document.category==='IDENTITY_IMAGE'||document.category===side).map(side=>{
    const expectedIds=current.filter(doc=>doc.category===side).map(doc=>doc.id);
    const selected=choices.some(choice=>choice.category===side&&choice.documentId===document.id);
    const replaces=expectedIds.some(id=>id!==document.id);
    return <button key={side} type="button" className="secondary-button" aria-pressed={selected}
     disabled={!ready||replaces&&!can('client.documents.replace')} onClick={()=>selected?onRemove(side):onChoose({category:side,documentId:document.id,expectedIds})}>
     {selected?`Quitar ${identitySideLabel(side).toLowerCase()} seleccionado`:`${replaces?'Confirmar reemplazo del':'Usar como'} ${identitySideLabel(side).toLowerCase()}`}
    </button>;
   })}</div>
  </article>)}</div>}
 </div>;
}
