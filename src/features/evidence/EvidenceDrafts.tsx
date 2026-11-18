import {Camera,ImagePlus,Upload} from 'lucide-react';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {useAuth} from '../../app/AuthProvider';
import {evidenceLabels,type EvidenceCategory,type PreparedEvidence} from '../../../shared/evidence';
import {uploadPhoto} from './upload';
import {ReceiptPdfPicker} from './ReceiptPdfPicker';
import './evidence.css';
import type {ClientDocumentView} from '../../../shared/client-documents';
import type {DniChoice,DniSide} from '../registrations/RegistrationDniExtraction';
interface Draft {category:EvidenceCategory;value:string;file:File;url:string;progress:number;busy:boolean;error?:string;prepared?:PreparedEvidence;receiptPage?:number;shared:boolean;assetId?:string;controller:AbortController}
export function useEvidenceDrafts(scope:string|{requestId:string}){
 const {api}=useAuth(),[drafts,setDrafts]=useState<Record<string,Draft>>({});const current=useRef(drafts);const live=useRef(true);
 useEffect(()=>{current.current=drafts;},[drafts]);
 useEffect(()=>{live.current=true;return()=>{live.current=false;for(const d of Object.values(current.current)){d.controller.abort();URL.revokeObjectURL(d.url);if(d.assetId)void api.request(`/evidence/uploads/${d.assetId}`,'DELETE',{}).catch(()=>{});}};},[api]);
 function discard(d:Draft){d.controller.abort();URL.revokeObjectURL(d.url);if(d.assetId)void api.request(`/evidence/uploads/${d.assetId}`,'DELETE',{}).catch(()=>{});}
 function remove(key:string){const old=current.current[key];if(old)discard(old);setDrafts(prev=>{const next={...prev};delete next[key];current.current=next;return next;});}
 function clear(){for(const d of Object.values(current.current))discard(d);current.current={};setDrafts({});}
 function patch(key:string,controller:AbortController,changes:Partial<Draft>){if(!live.current)return;setDrafts(prev=>prev[key]?.controller===controller?{...prev,[key]:{...prev[key],...changes}}:prev);}
 async function choose(category:EvidenceCategory,value:string,file:File,shared=false,receiptPage?:number){const key=`${category}:${value}`,old=current.current[key];if(old?.busy)return;
  const controller=new AbortController(),url=URL.createObjectURL(file);const draft:Draft={category,value,file,url,progress:0,busy:true,shared,receiptPage,controller};setDrafts(prev=>{const next={...prev,[key]:draft};current.current=next;return next;});let newAsset:string|undefined;
  try{const prepared=await uploadPhoto(api,file,category,typeof scope==='string'?{operationKey:scope}:scope,progress=>patch(key,controller,{progress}),controller.signal,id=>{newAsset=id;patch(key,controller,{assetId:id});},receiptPage);if(old)discard(old);patch(key,controller,{prepared,busy:false,progress:100});}
  catch(error){if(newAsset)void api.request(`/evidence/uploads/${newAsset}`,'DELETE',{}).catch(()=>{});if(old){URL.revokeObjectURL(url);setDrafts(prev=>prev[key]?.controller===controller?{...prev,[key]:{...old,error:error instanceof Error?error.message:'NO SE PUDO PREPARAR LA FOTO.'}}:prev);}else patch(key,controller,{busy:false,error:error instanceof Error?error.message:'NO SE PUDO PREPARAR LA FOTO.'});}
 }
 function share(key:string,shared:boolean){setDrafts(prev=>({...prev,[key]:{...prev[key],shared}}));}
 return {drafts,choose,remove,clear,share,links:(values:string[])=>Object.values(drafts).filter(d=>d.prepared&&values.includes(d.value)).map(d=>({assetId:d.prepared!.assetId,category:d.category,imeiValues:d.shared?values:[d.value]}))};
}
export function EvidenceDrafts({values,manager,slots,hasBox=true,savedIdentityCategories=[],currentIdentity=[],identityChoices=[],onIdentityChoose,onIdentityRemove,receiptPanel,receiptSelected=false,onReceiptPending}:{receiptSelected?:boolean;receiptPanel?:ReactNode;onReceiptPending?:(pending:boolean)=>void;values:string[];savedIdentityCategories?:string[];currentIdentity?:ClientDocumentView[];identityChoices?:DniChoice[];onIdentityChoose?:(choice:DniChoice)=>void;onIdentityRemove?:(side:DniSide)=>void;slots?:Record<string,number>;hasBox?:boolean;manager:ReturnType<typeof useEvidenceDrafts>}){
 const {can}=useAuth(),preview=useRef<HTMLDialogElement>(null),[image,setImage]=useState<{url:string;label:string}|null>(null);
 if(!can('registration.evidence.upload'))return <section className="form-panel"><p>Tu rol no tiene permiso para adjuntar fotografías. Puedes continuar sin ellas.</p></section>;
 const labels={...evidenceLabels,DNI_BACK:'DNI REVERSO'},descriptions={DNI_FRONT:'Foto del lado frontal del documento',DNI_BACK:'Foto del lado posterior del documento',DEVICE_BOX:'Foto de la caja y su etiqueta',PURCHASE_RECEIPT:'Foto completa de la boleta',LOGICAL_IMEI:'Foto de pantalla donde se vean los IMEI del equipo'};
 return <section className="form-panel evidence-reference"><p className="form-hint">Las fotos del DNI, de la caja y del IMEI lógico son opcionales. JPEG, PNG o WEBP · hasta 10 MB. Se guardan en almacenamiento privado y se incluyen en el expediente PDF.</p>{values.length===2&&<p className="form-hint">Una foto por categoría. Se adjuntará automáticamente a ambos IMEI.</p>}<div className="evidence-grid">{(['DNI_FRONT','DNI_BACK','DEVICE_BOX','PURCHASE_RECEIPT','LOGICAL_IMEI'] as const).flatMap(category=>values.map((value,index)=>{
  const isIdentity=category==='DNI_FRONT'||category==='DNI_BACK';
  if(index>0)return [];
  const existing=isIdentity?currentIdentity.filter(doc=>doc.category===category).map(doc=>doc.id):[];
  const choice=isIdentity?identityChoices.find(choice=>choice.category===category):undefined;
  if(isIdentity&&choice?.documentId)return [];
  if(isIdentity&&!choice&&(existing.length||savedIdentityCategories.includes(category))){
   if(!onIdentityChoose||!can('client.documents.replace')||!can('client.documents.upload'))return [];
   return <article className="evidence-card" key={category}>
    <h3>{labels[category]}</h3>
    <button type="button" className="secondary-button" onClick={()=>onIdentityChoose({category,expectedIds:existing})}>
     Confirmar reemplazo de {category==='DNI_FRONT'?'DNI frontal':'DNI posterior'}
    </button>
   </article>;
  }
  const slot=slots?.[value]??index+1,key=`${category}:${value}`,draft=manager.drafts[key],notApplicable=category==='DEVICE_BOX'&&!hasBox;
  if(isIdentity&&!can('client.documents.upload'))return <article className="evidence-card" key={key}><h3>{labels[category]}</h3><p>Tu rol necesita permiso para guardar el DNI del cliente. Pide ayuda a un administrador.</p></article>;
  const photoLabel=isIdentity?`${labels[category]} IMEI ${slot}`:labels[category];
  const select=(file:File|undefined)=>{if(file&&!notApplicable)void manager.choose(category,value,file,true);};
  return <article className={`evidence-card ${notApplicable?'not-applicable':''}`} key={key}><div className="evidence-card-heading"><h3>{labels[category]}</h3>{notApplicable&&<span className="not-applicable-badge">No aplica</span>}</div><p className="evidence-description">{notApplicable?'Deshabilitada porque el cliente no tiene caja':descriptions[category]}</p>{isIdentity&&choice&&<button type="button" className="text-button" onClick={()=>{manager.remove(key);onIdentityRemove?.(category);}}>Cancelar reemplazo</button>}{category==='PURCHASE_RECEIPT'&&receiptPanel}{draft?.receiptPage?<p className="form-hint">PDF original · página {draft.receiptPage} en el RECO</p>:draft?<button type="button" className="evidence-image-button" aria-label={`Ampliar ${photoLabel}`} onClick={()=>{setImage({url:draft.url,label:labels[category]});preview.current?.showModal();}}><img className="evidence-preview" src={draft.url} alt={photoLabel}/></button>:category==='PURCHASE_RECEIPT'&&receiptSelected?null:<div className="evidence-placeholder"><ImagePlus size={26} aria-hidden="true"/><span>{notApplicable?'El cliente indicó que no tiene caja':'Sin foto cargada'}</span></div>}{draft&&<p role="status">{draft.busy?`${draft.progress===0?'PREPARANDO':draft.progress===100?'VERIFICANDO':'SUBIENDO'} ${draft.progress}%`:draft.prepared?'ADJUNTADA':'SIN FOTO CARGADA'}</p>}{draft?.busy&&<progress max={100} value={draft.progress} aria-label="Progreso de carga"/>}{draft?.error&&<p role="alert">{draft.error}</p>}<div className="evidence-actions">{[true,false].map(camera=><label className="secondary-button" key={String(camera)} aria-disabled={notApplicable||draft?.busy}>{camera?<Camera size={15} aria-hidden="true"/>:<Upload size={15} aria-hidden="true"/>}{camera?'Tomar foto':draft?'Reemplazar':'Subir galería'}<input aria-label={`${camera?'Cámara':'Galería'} ${photoLabel}`} type="file" accept="image/jpeg,image/png,image/webp" capture={camera?'environment':undefined} disabled={notApplicable||draft?.busy} onChange={e=>{select(e.target.files?.[0]);e.target.value='';}}/></label>)}</div>{category==='PURCHASE_RECEIPT'&&<ReceiptPdfPicker imeis={slots?Object.keys(slots):values} busy={!!draft?.busy} onPending={onReceiptPending} select={(file,page)=>void manager.choose(category,value,file,true,page)}/>}{draft&&<div className="evidence-actions"><button type="button" className="text-button" onClick={()=>manager.remove(key)}>QUITAR FOTO</button>{!draft.busy&&!draft.prepared&&<button type="button" className="secondary-button" onClick={()=>void manager.choose(category,value,draft.file,draft.shared,draft.receiptPage)}>REINTENTAR</button>}</div>}</article>;
 }))}</div><dialog className="evidence-modal" ref={preview} aria-label="Ampliar evidencia"><button className="secondary-button" type="button" onClick={()=>preview.current?.close()}>Cerrar foto</button>{image&&<img src={image.url} alt={image.label}/>}</dialog></section>;
}
