import {useState} from 'react';
import {Share2} from 'lucide-react';
import {useAuth} from '../../app/AuthProvider';
import {ReferenceDialog} from '../../components/ReferenceDialog';
import {ErrorNotice} from '../../components/common';

export function ShareRegistration({id,code,compact=false}:{id:string;code:string;compact?:boolean}){
 const {api}=useAuth();
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [options,setOptions]=useState<{text:string;retryNative:boolean}|null>(null);
 const title=`Registro ${code}`;

 async function shareOnDevice(text:string,retryNative:boolean){
  try{
   await navigator.share({title,text});
   setOptions(null);
  }catch(error){
   if(error instanceof DOMException&&error.name==='AbortError'){
    setOptions(null);
    return;
   }
   setOptions({text,retryNative});
  }
 }

 async function share(){
  if(busy)return;
  setBusy(true);
  setError('');
  try{
   const {text}=await api.get<{text:string}>(`/registration-requests/${id}/share-text`);
   if(typeof navigator.share!=='function')setOptions({text,retryNative:false});
   else if(navigator.userActivation?.isActive===false)setOptions({text,retryNative:true});
   else await shareOnDevice(text,true);
  }catch(error){
   setError(error instanceof Error?error.message:'No se pudieron preparar los datos.');
  }finally{setBusy(false);}
 }

 return <>
  <button type="button" className={compact?'icon-button':'secondary-button'} aria-label={`Compartir ${code}`} title="Compartir registro" disabled={busy} onClick={()=>void share()}>
   <Share2 size={16} aria-hidden="true"/>{!compact&&(busy?'Preparando…':'Compartir')}
  </button>
  <ErrorNotice message={error}/>
  {options&&<ReferenceDialog label="Compartir registro" onClose={()=>setOptions(null)}>
   <header className="reference-modal-header"><h2>Compartir {code}</h2></header>
   <div className="form-actions">
    {options.retryNative&&<button type="button" className="primary-button" onClick={()=>void shareOnDevice(options.text,false)}>Elegir aplicación</button>}
    <a className="secondary-button" href={`https://wa.me/?text=${encodeURIComponent(options.text)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
    <a className="secondary-button" href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(options.text)}`}>Correo</a>
   </div>
  </ReferenceDialog>}
 </>;
}
