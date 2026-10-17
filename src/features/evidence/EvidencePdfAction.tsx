import {useCallback,useEffect,useRef,useState} from 'react';
import type {PDFDocumentLoadingTask,RenderTask} from 'pdfjs-dist';
import {useAuth} from '../../app/AuthProvider';
import {Link} from '../../app/router';
import {ErrorNotice,PageHeading} from '../../components/common';
import type {RegistrationRequest} from '../../types/pos';
import '../registrations/registration.css';
interface Document {url:string;name:string}
function EvidencePreview({document,onClose,print=false}:{document:Document;print?:boolean;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),canvas=useRef<HTMLCanvasElement>(null),frame=useRef<HTMLIFrameElement>(null);
 const [page,setPage]=useState(1),[pages,setPages]=useState(1),[ready,setReady]=useState(false),[error,setError]=useState('');
 useEffect(()=>{dialog.current?.showModal();},[]);
 useEffect(()=>{
  let disposed=false,loading:PDFDocumentLoadingTask|undefined,rendering:RenderTask|undefined;
  void (async()=>{try{const pdfjs=await import('pdfjs-dist'),worker=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');if(disposed)return;setReady(false);setError('');pdfjs.GlobalWorkerOptions.workerSrc=worker.default;loading=pdfjs.getDocument({url:document.url});const pdf=await loading.promise;if(disposed)return;setPages(pdf.numPages);const sheet=await pdf.getPage(page);if(disposed||!canvas.current)return;const viewport=sheet.getViewport({scale:1.5});canvas.current.width=viewport.width;canvas.current.height=viewport.height;rendering=sheet.render({canvas:canvas.current,viewport});await rendering.promise;if(!disposed)setReady(true);}catch{if(!disposed)setError('NO SE PUDO MOSTRAR LA PÁGINA. PUEDES DESCARGAR EL PDF.');}})();
  return()=>{disposed=true;rendering?.cancel();void loading?.destroy();};
 },[document.url,page]);
 return <dialog ref={dialog} onClose={onClose} className="evidence-pdf-preview" aria-label="Expediente de evidencias A4"><h2>EXPEDIENTE DE EVIDENCIAS</h2><p>{document.name}</p><div className="form-actions"><a href={document.url} download={document.name} className="secondary-button">DESCARGAR PDF</a><button type="button" className="primary-button" onClick={()=>{try{frame.current?.contentWindow?.print();}catch{setError('ABRE EL PDF Y USA LA OPCIÓN IMPRIMIR DEL NAVEGADOR.');}}}>IMPRIMIR</button><button type="button" className="secondary-button" onClick={()=>dialog.current?.close()}>CERRAR PDF</button></div><div className="evidence-pdf-pages"><button type="button" className="secondary-button" disabled={page===1} onClick={()=>setPage(p=>p-1)}>ANTERIOR</button><span>Página {page} de {pages}</span><button type="button" className="secondary-button" disabled={page===pages} onClick={()=>setPage(p=>p+1)}>SIGUIENTE</button></div><ErrorNotice message={error}/>{!ready&&!error&&<p role="status">CARGANDO DOCUMENTO A4...</p>}<canvas ref={canvas} hidden={!ready} role="img" aria-label={`Página ${page} del expediente de evidencias`} data-ready={ready}/><iframe ref={frame} title="Expediente A4 para impresión" src={document.url} onLoad={()=>{if(print)frame.current?.contentWindow?.print();}} className="declaration-print-frame"/><p>PAPEL A4 · ESCALA 100%. <a className="inline-link" href={document.url} target="_blank" rel="noopener">ABRIR PDF</a></p></dialog>;
}
export function EvidencePdfAction({id,auto=false,autoOpen=true}:{id:string;auto?:boolean;autoOpen?:boolean}){
 const {api,can}=useAuth(),started=useRef(false),busyRef=useRef(false),live=useRef(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[document,setDocument]=useState<Document|null>(null),[preview,setPreview]=useState(false),[printing,setPrinting]=useState(false);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 const permitted=can('registration.read')&&can('registration.evidence.read');
 const generate=useCallback(async(open=true)=>{if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');try{const result=await api.post<{pdfBase64:string;fileName:string}>(`/registration-requests/${id}/evidence-pdf`,{});if(!live.current)return;const bytes=Uint8Array.from(atob(result.pdfBase64),c=>c.charCodeAt(0)),doc={url:URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),name:result.fileName};setDocument(doc);if(open)setPreview(true);}catch(e){if(live.current)setError(e instanceof Error?e.message:'NO SE PUDO GENERAR EL PDF. REINTENTA EL DOCUMENTO.');}finally{busyRef.current=false;if(live.current)setBusy(false);}},[api,id]);
 useEffect(()=>{const timer=requestAnimationFrame(()=>{if(auto&&permitted&&!started.current){started.current=true;void generate(autoOpen);}});return()=>cancelAnimationFrame(timer);},[auto,autoOpen,permitted,generate]);
 useEffect(()=>()=>{if(document)URL.revokeObjectURL(document.url);},[document]);
 if(!permitted)return <p className="form-hint">SE REQUIERE PERMISO DE LECTURA DE EVIDENCIAS PARA GENERAR EL EXPEDIENTE.</p>;
 return <><div className="form-actions"><button type="button" className="secondary-button" disabled={busy} onClick={()=>document?setPreview(true):void generate()}>{busy?'GENERANDO PDF...':error?'REINTENTAR PDF DE EVIDENCIAS':'VER PDF DE EVIDENCIAS'}</button>{document&&<><a className="secondary-button" href={document.url} download={document.name}>DESCARGAR PDF</a><button type="button" className="secondary-button" onClick={()=>{setPrinting(true);setPreview(true);}}>IMPRIMIR</button></>}</div><ErrorNotice message={error}/>{preview&&document&&<EvidencePreview document={document} print={printing} onClose={()=>{setPreview(false);setPrinting(false);}}/>}</>;
}
export function RegistrationSuccess({requests,onNew}:{requests:RegistrationRequest[];onNew:()=>void}){
 return <section className="registration-success"><PageHeading title="REGISTRO GUARDADO CORRECTAMENTE" description="La operación se confirmó. El expediente puede reintentarse sin duplicar registros."/>{requests.map((row,index)=><article className="form-panel" key={row.id}><h2><Link className="inline-link" to={`/registros/${row.id}`}>{row.code}</Link></h2><p>IMEI {row.imei?.value} · {row.status==='BLOCKED'?'BLOQUEADO':'REGISTRO PENDIENTE'}</p><EvidencePdfAction id={row.id} auto autoOpen={index===0}/><Link className="inline-link" to={`/registros/${row.id}`}>IR AL DETALLE DEL REGISTRO</Link></article>)}<button type="button" className="primary-button" onClick={onNew}>NUEVO REGISTRO</button></section>;
}
