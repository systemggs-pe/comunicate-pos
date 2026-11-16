import {useCallback,useEffect,useRef,useState} from 'react';
import {useAuth} from '../../app/AuthProvider';
import {Link} from '../../app/router';
import {ErrorNotice,PageHeading} from '../../components/common';
import type {RegistrationRequest} from '../../types/pos';
import '../registrations/registration.css';
interface Document {url:string;name:string}
function download(document:Document){
 const anchor=window.document.createElement('a');anchor.href=document.url;anchor.download=document.name;
 window.document.body.appendChild(anchor);anchor.click();anchor.remove();
}
export function EvidencePdfAction({id,auto=false,compressed=false}:{id:string;auto?:boolean;compressed?:boolean}){
 const {api,can}=useAuth(),started=useRef(false),busyRef=useRef(false),live=useRef(true);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[document,setDocument]=useState<Document|null>(null);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 const permitted=can('registration.read')&&can('registration.evidence.read');
 const label=compressed?'Descargar RECO comprimido':'Descargar PDF';
 const generate=useCallback(async()=>{
  if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');
  try{
   const result=await api.post<{pdfBase64:string;fileName:string}>(`/registration-requests/${id}/evidence-pdf`,compressed?{compressed:true}:{});
   if(!live.current)return;
   const bytes=Uint8Array.from(atob(result.pdfBase64),c=>c.charCodeAt(0));
   const file={url:URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),name:result.fileName};
   setDocument(file);download(file);
  }catch(e){if(live.current)setError(e instanceof Error?e.message:'No se pudo descargar el PDF. Reintenta el documento.');}
  finally{busyRef.current=false;if(live.current)setBusy(false);}
 },[api,id,compressed]);
 useEffect(()=>{const frame=requestAnimationFrame(()=>{if(auto&&permitted&&!started.current){started.current=true;void generate();}});return()=>cancelAnimationFrame(frame);},[auto,permitted,generate]);
 useEffect(()=>()=>{if(document)URL.revokeObjectURL(document.url);},[document]);
 if(!permitted)return <p className="form-hint">Se requiere permiso de lectura de evidencias para descargar el expediente.</p>;
 return <><div className="form-actions">{document?<a className="secondary-button" href={document.url} download={document.name}>{label}</a>:<button type="button" className="secondary-button" disabled={busy} onClick={()=>void generate()}>{busy?'Preparando PDF…':error?(compressed?'Reintentar descarga del RECO comprimido':'Reintentar descarga del PDF'):label}</button>}</div><ErrorNotice message={error}/></>;
}
export function RegistrationSuccess({requests,onNew}:{requests:RegistrationRequest[];onNew:()=>void}){
 return <section className="registration-success"><PageHeading title="REGISTRO GUARDADO CORRECTAMENTE" description="El PDF se descarga automáticamente. Puedes descargarlo de nuevo sin repetir el registro."/>{requests.map(row=><article className="form-panel" key={row.id}><h2><Link className="inline-link" to={`/registros/${row.id}`}>{row.code}</Link></h2><p>IMEI {row.imei?.value} · {row.status==='BLOCKED'?'BLOQUEADO':'REGISTRO PENDIENTE'}</p><EvidencePdfAction id={row.id} auto/><Link className="inline-link" to={`/registros/${row.id}`}>IR AL DETALLE DEL REGISTRO</Link></article>)}<button type="button" className="primary-button" onClick={onNew}>NUEVO REGISTRO</button></section>;
}
