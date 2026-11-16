import {Trash2} from 'lucide-react';
import {useRef,useState,useId} from 'react';
import {useAuth} from '../app/AuthProvider';
import {useSubmit} from '../hooks/useSubmit';
import {ErrorNotice} from './common';
import type {PermissionKey} from '../../shared/auth';
interface Plan {code:string;fingerprint:string}
export function PermanentDelete({path,code,permission,onDeleted,iconOnly=false,label}:{label?:string;iconOnly?:boolean;path:string;code:string;permission:PermissionKey;onDeleted:()=>void}){
 const {api,can}=useAuth(),submit=useSubmit(),dialog=useRef<HTMLDialogElement>(null),title=useId();
 const [plan,setPlan]=useState<Plan|null>(null),[notice,setNotice]=useState('');
 if(!can(permission))return null;
 async function preview(){
  setNotice('');
  const result=await submit.run(()=>api.get<Plan>(`/${path}/deletion-preview`));
  if(result){setPlan(result);if(!dialog.current?.open)dialog.current?.showModal();}
 }
 async function confirm(){
  if(!plan)return;
  const result=await submit.run(()=>api.request<{cleanup?:{pending:string[]}}>(`/${path}`,'DELETE',{
   confirm:'ELIMINAR',fingerprint:plan.fingerprint,reason:'Eliminación confirmada por el usuario.',removeOrphanEquipment:false,
  }));
  if(result){
   setNotice(result.cleanup?.pending.length?'Eliminado. La limpieza de archivos pendientes se reintentará automáticamente.':'Eliminado correctamente.');
   dialog.current?.close();onDeleted();
  }
 }
 return <><button type="button" aria-label={`ELIMINAR DEFINITIVAMENTE ${code}`} className={iconOnly?'icon-button danger':'secondary-button'} disabled={submit.busy} onClick={()=>void preview()}>{iconOnly?<Trash2 size={17} aria-hidden="true"/>:label??`ELIMINAR DEFINITIVAMENTE ${code}`}</button>
 {!plan&&<ErrorNotice message={submit.error}/>}{notice&&<p role="status">{notice}</p>}
 <dialog ref={dialog} className="delete-dialog delete-confirm-dialog" aria-labelledby={title} aria-describedby={`${title}-description`} onCancel={e=>{if(submit.busy)e.preventDefault();}} onClose={()=>setPlan(null)}>
  <h2 id={title}>¿Quieres eliminar {plan?.code??code}?</h2>
  <p id={`${title}-description`}>Se eliminará definitivamente.</p>
  <ErrorNotice message={submit.error}/>
  <div className="form-actions"><button type="button" className="secondary-button" autoFocus disabled={submit.busy} onClick={()=>dialog.current?.close()}>Cancelar</button><button type="button" className="primary-button" disabled={submit.busy||!plan} onClick={()=>void confirm()}>{submit.busy?'Eliminando…':'Confirmar'}</button></div>
 </dialog></>;
}
