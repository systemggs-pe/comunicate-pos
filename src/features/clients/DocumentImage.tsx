import {useState} from 'react';
import {Expand,Download,RotateCw,LoaderCircle} from 'lucide-react';
import {useAuth} from '../../app/AuthProvider';
import {useApiQuery} from '../../hooks/useApiQuery';
import {ReferenceDialog} from '../../components/ReferenceDialog';
export function DocumentImage({path,label}:{path:string;label:string}){
 const {api}=useAuth(),query=useApiQuery<{url:string}>(path);
 const [image,setImage]=useState(''),[error,setError]=useState(''),[retry,setRetry]=useState(0),[busy,setBusy]=useState<'view'|'download'|null>(null),[loadedUrl,setLoadedUrl]=useState('');
 async function open(download=false){if(busy)return;setBusy(download?'download':'view');setError('');try{const result=await api.get<{url:string}>(path+(download?'?download=true':''));if(download){const link=document.createElement('a');link.href=result.url;link.rel='noreferrer';link.click();}else setImage(result.url);}catch(e){setError(e instanceof Error?e.message:'No pudimos abrir la foto. Inténtalo de nuevo.');}finally{setBusy(null);}}
 const loading=query.loading||!!query.data&&loadedUrl!==query.data.url&&!error;
 return <div className="document-image"><div className="document-photo-frame" aria-busy={loading}>{loading&&<div className="document-photo-loading" role="status"><LoaderCircle className="dni-photo-spinner" size={22} aria-hidden="true"/><span>Cargando foto…</span></div>}{query.data&&<img className={`document-thumbnail${loadedUrl===query.data.url?' is-loaded':''}`} src={query.data.url} alt={label} referrerPolicy="no-referrer" crossOrigin="anonymous" onLoad={()=>setLoadedUrl(query.data!.url)} onError={()=>{if(retry<2){setRetry(retry+1);query.refresh();}else setError('La foto no está disponible. Inténtalo de nuevo.');}}/>}</div>
 {query.error&&<p role="alert">{query.error.message}</p>}<div className="document-actions"><button type="button" className="secondary-button" disabled={!!busy||query.loading} onClick={()=>void open()}>{busy==='view'?<LoaderCircle className="dni-photo-spinner" size={16} aria-hidden="true"/>:<Expand size={16} aria-hidden="true"/>}Ampliar</button><button type="button" className="secondary-button" disabled={!!busy||query.loading} onClick={()=>void open(true)}>{busy==='download'?<LoaderCircle className="dni-photo-spinner" size={16} aria-hidden="true"/>:<Download size={16} aria-hidden="true"/>}Descargar</button>{(query.error||error)&&<button type="button" className="text-button" onClick={()=>{setRetry(0);setError('');query.refresh();}}><RotateCw size={15} aria-hidden="true"/>Reintentar</button>}</div>{error&&<p className="dni-photo-error" role="alert">{error}</p>}
 {image&&<ReferenceDialog label={label} className="document-modal" onClose={()=>setImage('')}><header className="reference-modal-header"><h2>{label}</h2></header><img src={image} alt={label+' ampliado'} referrerPolicy="no-referrer" crossOrigin="anonymous"/></ReferenceDialog>}
 </div>;
}
