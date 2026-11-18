import {useEffect,useRef,useState} from 'react';
import {FileUp} from 'lucide-react';
import {maxEvidenceBytes} from '../../../shared/evidence';

async function inspect(file:File,imeis:string[]){
 if(file.size<5||file.size>maxEvidenceBytes)throw Error('Sube un PDF de hasta 10 MB.');
 const pdfjs=await import('pdfjs-dist');
 const worker=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
 pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
 const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),stopAtErrors:true,enableXfa:false});
 try{
  const pdf=await task.promise;
  if(pdf.numPages<1||pdf.numPages>30)throw Error('La boleta debe tener entre 1 y 30 páginas.');
  if(pdf.numPages===1)return {count:1,selected:1};
  const matches:number[]=[];
  for(let number=1;number<=pdf.numPages;number++){
   const page=await pdf.getPage(number);
   const words=(await page.getTextContent()).items.flatMap(item=>'str' in item?[item.str]:[]).join(' ');
   if(imeis.some(imei=>/^\d{15}$/.test(imei)&&new RegExp(`(^|\\D)${imei}(\\D|$)`).test(words)))matches.push(number);
  }
  return {count:pdf.numPages,selected:matches.length===1?matches[0]:0};
 }finally{await task.destroy();}
}

export function ReceiptPdfPicker({imeis,busy,select,onPending}:{imeis:string[];busy:boolean;select:(file:File,page:number)=>void;onPending?:(value:boolean)=>void}){
 const serial=useRef(0);
 const [pending,setPending]=useState<{file:File;count:number;page:number;url:string}|null>(null);
 const [error,setError]=useState(''),[loading,setLoading]=useState(false);
 useEffect(()=>()=>{serial.current++;onPending?.(false);},[onPending]);
 useEffect(()=>()=>{if(pending?.url)URL.revokeObjectURL(pending.url);},[pending?.url]);
 async function choose(file:File){
  const id=++serial.current;setError('');setPending(null);setLoading(true);onPending?.(true);
  try{
   const {count,selected}=await inspect(file,imeis);
   if(serial.current!==id)return;
   if(selected){select(file,selected);onPending?.(false);}
   else setPending({file,count,page:0,url:URL.createObjectURL(file)});
  }catch(cause){if(serial.current===id){setError(cause instanceof Error?cause.message:'No se pudo abrir el PDF.');onPending?.(false);}}
  finally{if(serial.current===id)setLoading(false);}
 }
 return <>
  <div className="evidence-actions"><label className="secondary-button"><FileUp size={15} aria-hidden="true"/>Subir PDF original
   <input aria-label="Subir PDF original" type="file" accept="application/pdf" disabled={busy||loading}
    onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void choose(file);}}/>
  </label></div>
  {loading&&<p role="status">Revisando las páginas de la boleta…</p>}
  {error&&<p role="alert">{error}</p>}
  {pending&&<div className="registration-receipt">
   <p>No se pudo identificar una sola página para este equipo.</p>
   <a className="text-button" href={pending.url} target="_blank" rel="noopener noreferrer">Ver PDF original</a>
   <label>Página que identifica al equipo<select aria-label="Página que identifica al equipo" value={pending.page}
    onChange={event=>setPending({...pending,page:Number(event.target.value)})}>
    <option value={0}>Selecciona una página</option>
    {Array.from({length:pending.count},(_,index)=><option key={index+1} value={index+1}>Página {index+1}</option>)}
   </select></label>
   <div className="evidence-actions">
    <button type="button" className="secondary-button" disabled={!pending.page||busy} onClick={()=>{select(pending.file,pending.page);setPending(null);onPending?.(false);}}>Usar esta página</button>
    <button type="button" className="text-button" onClick={()=>{setPending(null);onPending?.(false);}}>Cancelar PDF</button>
   </div>
  </div>}
 </>;
}
