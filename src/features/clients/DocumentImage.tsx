import {useRef,useState} from 'react';
import {useAuth} from '../../app/AuthProvider';
import {useApiQuery} from '../../hooks/useApiQuery';
export function DocumentImage({path,label}:{path:string;label:string}){
 const {api}=useAuth(),query=useApiQuery<{url:string}>(path),dialog=useRef<HTMLDialogElement>(null);
 const [image,setImage]=useState(''),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 async function open(download=false){try{const result=await api.get<{url:string}>(path+(download?'?download=true':''));setError('');if(download){const link=document.createElement('a');link.href=result.url;link.rel='noreferrer';link.click();}else{setImage(result.url);dialog.current?.showModal();}}catch(e){setError(e instanceof Error?e.message:'NO SE PUDO ABRIR EL DOCUMENTO.');}}
 return <div className="document-image">{query.data&&<img className="document-thumbnail" src={query.data.url} alt={label} referrerPolicy="no-referrer" crossOrigin="anonymous" onError={()=>{if(retry<2){setRetry(retry+1);query.refresh();}else setError('ARCHIVO NO DISPONIBLE. REINTENTA.');}}/>}
  {query.error&&<p role="alert">{query.error.message}</p>}<div className="document-actions"><button type="button" className="secondary-button" onClick={()=>void open()}>VER</button><button type="button" className="secondary-button" onClick={()=>void open(true)}>DESCARGAR</button>{(query.error||error)&&<button type="button" className="text-button" onClick={()=>{setRetry(0);setError('');query.refresh();}}>REINTENTAR FOTO</button>}</div>{error&&<p role="alert">{error}</p>}
  <dialog className="document-modal" ref={dialog}><button type="button" className="secondary-button" onClick={()=>dialog.current?.close()}>CERRAR DOCUMENTO</button>{image&&<img src={image} alt={label+' ampliado'} referrerPolicy="no-referrer" crossOrigin="anonymous"/>}</dialog>
 </div>;
}
