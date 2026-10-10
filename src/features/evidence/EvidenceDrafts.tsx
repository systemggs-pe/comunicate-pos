import {Camera} from 'lucide-react';
import {useEffect,useRef,useState} from 'react';
import {useAuth} from '../../app/AuthProvider';
import {evidenceCategories,evidenceLabels,type EvidenceCategory,type PreparedEvidence} from '../../../shared/evidence';
import {uploadPhoto} from './upload';
import './evidence.css';
interface Draft {category:EvidenceCategory;value:string;file:File;url:string;progress:number;busy:boolean;error?:string;prepared?:PreparedEvidence;shared:boolean;assetId?:string;controller:AbortController}
export function useEvidenceDrafts(operationKey:string){
 const {api}=useAuth(),[drafts,setDrafts]=useState<Record<string,Draft>>({});const current=useRef(drafts);const live=useRef(true);
 useEffect(()=>{current.current=drafts;},[drafts]);
 useEffect(()=>{live.current=true;return()=>{live.current=false;for(const d of Object.values(current.current)){d.controller.abort();URL.revokeObjectURL(d.url);if(d.assetId)void api.request(`/evidence/uploads/${d.assetId}`,'DELETE',{}).catch(()=>{});}};},[api]);
 function discard(d:Draft){d.controller.abort();URL.revokeObjectURL(d.url);if(d.assetId)void api.request(`/evidence/uploads/${d.assetId}`,'DELETE',{}).catch(()=>{});}
 function remove(key:string){const old=current.current[key];if(old)discard(old);setDrafts(prev=>{const next={...prev};delete next[key];current.current=next;return next;});}
 function clear(){for(const d of Object.values(current.current))discard(d);current.current={};setDrafts({});}
 function patch(key:string,controller:AbortController,changes:Partial<Draft>){if(!live.current)return;setDrafts(prev=>prev[key]?.controller===controller?{...prev,[key]:{...prev[key],...changes}}:prev);}
 async function choose(category:EvidenceCategory,value:string,file:File,shared=false){const key=`${category}:${value}`,old=current.current[key];if(old?.busy)return;
  const controller=new AbortController(),url=URL.createObjectURL(file);const draft:Draft={category,value,file,url,progress:0,busy:true,shared,controller};setDrafts(prev=>{const next={...prev,[key]:draft};current.current=next;return next;});let newAsset:string|undefined;
  try{const prepared=await uploadPhoto(api,file,category,{operationKey},progress=>patch(key,controller,{progress}),controller.signal,id=>{newAsset=id;patch(key,controller,{assetId:id});});if(old)discard(old);patch(key,controller,{prepared,busy:false,progress:100});}
  catch(error){if(newAsset)void api.request(`/evidence/uploads/${newAsset}`,'DELETE',{}).catch(()=>{});if(old){URL.revokeObjectURL(url);setDrafts(prev=>prev[key]?.controller===controller?{...prev,[key]:{...old,error:error instanceof Error?error.message:'NO SE PUDO PREPARAR LA FOTO.'}}:prev);}else patch(key,controller,{busy:false,error:error instanceof Error?error.message:'NO SE PUDO PREPARAR LA FOTO.'});}
 }
 function share(key:string,shared:boolean){setDrafts(prev=>({...prev,[key]:{...prev[key],shared}}));}
 return {drafts,choose,remove,clear,share,busy:Object.values(drafts).some(d=>d.busy),invalid:Object.values(drafts).some(d=>!d.prepared),links:(values:string[])=>Object.values(drafts).filter(d=>d.prepared&&values.includes(d.value)).map(d=>({assetId:d.prepared!.assetId,category:d.category,imeiValues:d.shared&&d.category!=='LOGICAL_IMEI'?values:[d.value]}))};
}
export function EvidenceDrafts({values,manager}:{values:string[];manager:ReturnType<typeof useEvidenceDrafts>}){
 const {can}=useAuth();if(!can('registration.evidence.upload'))return <section className="form-panel"><h2>EVIDENCIAS OPCIONALES</h2><p>Tu rol no tiene permiso para adjuntar fotografías. Puedes continuar sin ellas.</p></section>;
 return <section className="form-panel"><h2>EVIDENCIAS OPCIONALES</h2><p>JPEG, PNG o WEBP · Hasta 10 MB y 20 millones de píxeles. Las fotos se guardarán con las solicitudes al confirmar.</p><div className="evidence-grid">{evidenceCategories.flatMap(category=>values.map((value,index)=>{
  const key=`${category}:${value}`,draft=manager.drafts[key],first=manager.drafts[`${category}:${values[0]}`];if(index>0&&category!=='LOGICAL_IMEI'&&first?.shared)return [];
  const select=(file:File|undefined)=>{if(file)void manager.choose(category,value,file,draft?.shared);};
  return <article className="evidence-card" key={key}><h3><Camera size={18} aria-hidden="true"/> {evidenceLabels[category]} · IMEI {index+1}</h3>{draft&&<img className="evidence-preview" src={draft.url} alt={`${evidenceLabels[category]} IMEI ${index+1}`} />}<p role="status">{draft?.busy?`${draft.progress===0?'PREPARANDO':draft.progress===100?'VERIFICANDO':'SUBIENDO'} ${draft.progress}%`:draft?.prepared?'PREPARADA PARA CONFIRMAR':'SIN FOTO'}</p>{draft?.busy&&<progress max={100} value={draft.progress} aria-label="Progreso de carga"/>}{draft?.error&&<p role="alert">{draft.error}</p>}<div className="evidence-actions">{[false,true].map(camera=><label className="secondary-button" key={String(camera)}>{camera?'TOMAR FOTO':'SUBIR FOTO'}<input aria-label={`${camera?'Cámara':'Galería'} ${evidenceLabels[category]} IMEI ${index+1}`} type="file" accept="image/jpeg,image/png,image/webp" capture={camera?'environment':undefined} disabled={draft?.busy} onChange={e=>{select(e.target.files?.[0]);e.target.value='';}}/></label>)}</div>{draft&&<div className="evidence-actions"><button type="button" className="text-button" onClick={()=>manager.remove(key)}>QUITAR FOTO</button>{!draft.busy&&!draft.prepared&&<button type="button" className="secondary-button" onClick={()=>void manager.choose(category,value,draft.file,draft.shared)}>REINTENTAR</button>}</div>}{index===0&&category!=='LOGICAL_IMEI'&&values.length===2&&draft&&<label className="checkbox-label"><input type="checkbox" checked={draft.shared} disabled={!!manager.drafts[`${category}:${values[1]}`]} onChange={e=>manager.share(key,e.target.checked)}/>COMPARTIR ESTA FOTO CON AMBAS SOLICITUDES</label>}{index===0&&category!=='LOGICAL_IMEI'&&values.length===2&&!!manager.drafts[`${category}:${values[1]}`]&&<p>Para compartir, retira primero la foto independiente del segundo IMEI.</p>}</article>;
 }))}</div></section>;
}
