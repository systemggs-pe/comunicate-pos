import {useEffect,useRef,useState} from 'react';
import {ErrorNotice} from '../../components/common';
import type {PDFDocumentLoadingTask,RenderTask} from 'pdfjs-dist';
// Render the actual PDF, rather than a second HTML version of its template.
export function PdfPreview({url}:{url:string}){
 const canvas=useRef<HTMLCanvasElement>(null),[state,setState]=useState<'loading'|'ready'|'error'>('loading'),[error,setError]=useState('');
 useEffect(()=>{
  let disposed=false,loading:PDFDocumentLoadingTask|undefined,rendering:RenderTask|undefined;
  async function render(){
   try{
    const pdfjs=await import('pdfjs-dist');
    const worker=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    if(disposed)return;
    pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
    loading=pdfjs.getDocument({url});
    const pdf=await loading.promise;if(disposed)return;
    const page=await pdf.getPage(1);if(disposed||!canvas.current)return;
    const viewport=page.getViewport({scale:2});canvas.current.width=Math.ceil(viewport.width);canvas.current.height=Math.ceil(viewport.height);
    rendering=page.render({canvas:canvas.current,viewport});await rendering.promise;
    if(!disposed)setState('ready');
   }catch{if(!disposed){setError('NO SE PUDO MOSTRAR LA VISTA PREVIA. ABRE O DESCARGA EL PDF PARA REVISARLO.');setState('error');}}
  }
  void render();
  return ()=>{disposed=true;rendering?.cancel();void loading?.destroy();};
 },[url]);
 return <div className="declaration-pdf-view">{state==='loading'&&<p role="status">CARGANDO DOCUMENTO A4...</p>}<ErrorNotice message={error}/><canvas ref={canvas} role="img" aria-label="PREVISUALIZACIÓN DEL PDF A4" data-ready={state==='ready'} hidden={state!=='ready'}/></div>;
}
