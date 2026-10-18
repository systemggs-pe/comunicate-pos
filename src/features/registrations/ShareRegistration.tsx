import {useState} from 'react';
import {Share2} from 'lucide-react';
import {useAuth} from '../../app/AuthProvider';
import {ReferenceDialog} from '../../components/ReferenceDialog';
import {ErrorNotice} from '../../components/common';
export function ShareRegistration({id,code,compact=false}:{id:string;code:string;compact?:boolean}){
 const {api}=useAuth(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[manual,setManual]=useState('');
 async function copy(){if(busy)return;setBusy(true);setError('');setNotice('');try{const {text}=await api.get<{text:string}>(`/registration-requests/${id}/share-text`);try{await navigator.clipboard.writeText(text);setNotice('DATOS COPIADOS AL PORTAPAPELES');}catch{setManual(text);}}catch(e){setError(e instanceof Error?e.message:'No se pudieron preparar los datos.');}finally{setBusy(false);}}
 return <><button type="button" className={compact?'icon-button':'secondary-button'} aria-label={`Compartir ${code}`} title="Copiar datos del registro" disabled={busy} onClick={()=>void copy()}><Share2 size={16}/>{!compact&&(busy?'Preparando...':'Compartir')}</button>{notice&&<p className="share-notice" role="status">{notice}</p>}<ErrorNotice message={error}/>{manual&&<ReferenceDialog label="Copiar datos del registro" onClose={()=>setManual('')}><header className="reference-modal-header"><h2>Copia los datos manualmente</h2><p>El navegador no permitió acceder al portapapeles.</p></header><textarea aria-label="Datos del registro para copiar" className="share-manual" readOnly value={manual} onFocus={e=>e.target.select()}/><button className="secondary-button" onClick={()=>setManual('')}>Cerrar</button></ReferenceDialog>}</>;
}
