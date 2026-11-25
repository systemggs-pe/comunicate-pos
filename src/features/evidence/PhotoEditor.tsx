import {useEffect,useId,useLayoutEffect,useRef,useState,type PointerEvent} from 'react';
import {RotateCcw,RotateCw} from 'lucide-react';
import {ReferenceDialog} from '../../components/ReferenceDialog';
import {maxEvidenceBytes} from '../../../shared/evidence';
import {decodePhoto} from './upload';
import './photo-editor.css';

type Crop={left:number;top:number;right:number;bottom:number};
type Edge=keyof Crop;
const edges={left:'Izquierdo',top:'Superior',right:'Derecho',bottom:'Inferior'};
const corners=[['left','top'],['right','top'],['left','bottom'],['right','bottom']] as const;
const minSide=32;
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(n,max));

function dimensions(bitmap:ImageBitmap,turn:number){
 return turn%2===0?{width:bitmap.width,height:bitmap.height}:{width:bitmap.height,height:bitmap.width};
}

function draw(canvas:HTMLCanvasElement,bitmap:ImageBitmap,turn:number,ratio:number,crop:Crop){
 canvas.width=Math.round((crop.right-crop.left)*ratio);
 canvas.height=Math.round((crop.bottom-crop.top)*ratio);
 const ctx=canvas.getContext('2d');
 if(!ctx)throw Error('No se pudo preparar la imagen en este navegador.');
 const {width,height}=dimensions(bitmap,turn);
 ctx.scale(ratio,ratio);
 ctx.translate(-crop.left,-crop.top);
 ctx.translate(turn===1||turn===2?width:0,turn===2||turn===3?height:0);
 ctx.rotate(turn*Math.PI/2);
 ctx.drawImage(bitmap,0,0);
}

function encode(canvas:HTMLCanvasElement,type:string,quality?:number){
 return new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,type,quality));
}

export function PhotoEditor({file,label,onApply,onCancel}:{file:File;label:string;onApply:(file:File)=>void;onCancel:()=>void}){
 const hintId=useId();
 const [source,setSource]=useState<ImageBitmap|null>(null),[turn,setTurn]=useState(0);
 const [selection,setSelection]=useState<Crop|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [frameSize,setFrameSize]=useState({width:0,height:0});
 const preview=useRef<HTMLCanvasElement>(null),stage=useRef<HTMLDivElement>(null);
 const live=useRef(false);
 const drag=useRef<{pointer:number;x:number;y:number;start:Crop;scale:number}|null>(null);

 useEffect(()=>{
  live.current=true;
  let active=true,decoded:ImageBitmap|undefined;
  void decodePhoto(file).then(bitmap=>{
   if(!active){bitmap.close();return;}
   decoded=bitmap;
   setSource(bitmap);
  }).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'No se pudo abrir esta fotografía.');});
  return()=>{active=false;live.current=false;decoded?.close();};
 },[file]);

 useLayoutEffect(()=>{
  const node=stage.current;
  if(!node)return;
  const observer=new ResizeObserver(([entry])=>setFrameSize({width:entry.contentRect.width,height:entry.contentRect.height}));
  observer.observe(node);
  return()=>observer.disconnect();
 },[]);

 const {width,height}=source?dimensions(source,turn):{width:0,height:0};
 const scale=source?Math.min(1,frameSize.width/width,frameSize.height/height):0;
 const previewReady=scale>0;
 const whole={left:0,top:0,right:width,bottom:height};
 const crop=selection??whole;
 useLayoutEffect(()=>{
  if(!source||!preview.current||!previewReady)return;
  const size=dimensions(source,turn);
  const ratio=Math.min(1,1200/Math.max(size.width,size.height));
  draw(preview.current,source,turn,ratio,{left:0,top:0,right:size.width,bottom:size.height});
 },[source,turn,previewReady]);

 function move(c:Crop,edge:Edge,position:number){
  const min={left:0,top:0,right:c.left+minSide,bottom:c.top+minSide}[edge];
  const max={left:c.right-minSide,top:c.bottom-minSide,right:width,bottom:height}[edge];
  return {...c,[edge]:clamp(Math.round(position),min,max)};
 }

 function dragCorner(event:PointerEvent<HTMLButtonElement>,horizontal:Edge,vertical:Edge){
  const current=drag.current;
  if(!current||event.pointerId!==current.pointer)return;
  const horizontalMove=move(current.start,horizontal,current.start[horizontal]+(event.clientX-current.x)/current.scale);
  setSelection(move(horizontalMove,vertical,current.start[vertical]+(event.clientY-current.y)/current.scale));
 }

 function rotate(delta:number){
  // The selection follows the photographed area as it turns.
  if(selection)setSelection(delta===1
   ?{left:height-crop.bottom,top:crop.left,right:height-crop.top,bottom:crop.right}
   :{left:crop.top,top:width-crop.right,right:crop.bottom,bottom:width-crop.left});
  setTurn((turn+delta+4)%4);
 }

 async function apply(){
  if(!source||busy)return;
  if(!turn&&crop.left===0&&crop.top===0&&crop.right===width&&crop.bottom===height){onApply(file);return;}
  setBusy(true);
  setError('');
  const canvas=document.createElement('canvas');
  try{
   draw(canvas,source,turn,1,crop);
   let blob=await encode(canvas,'image/png');
   if(!blob||blob.size>maxEvidenceBytes){
    blob=await encode(canvas,'image/jpeg',0.95);
    if(!blob||blob.size>maxEvidenceBytes)blob=await encode(canvas,'image/jpeg',0.88);
   }
   if(!blob||!blob.size||blob.size>maxEvidenceBytes)throw Error('El resultado supera 10 MB. Reduce el área recortada.');
   if(live.current)onApply(new File([blob],`${file.name.replace(/\.[^.]+$/,'')}-editada.${blob.type==='image/png'?'png':'jpg'}`,{type:blob.type}));
  }catch(reason){
   if(live.current)setError(reason instanceof Error?reason.message:'No se pudo guardar el ajuste.');
  }finally{
   canvas.width=canvas.height=1;
   if(live.current)setBusy(false);
  }
 }

 return <ReferenceDialog label="Editar foto" className="photo-editor" mobile="full" onClose={()=>{if(!busy)onCancel();}}>
  <header className="reference-modal-header"><h2>Editar foto</h2><p>{label}</p></header>
  <div className="photo-editor-body">
   <p className="photo-editor-hint" id={hintId}>Arrastra las esquinas para ajustar el recorte.</p>
   <div className="photo-editor-stage"><div className="photo-editor-space" ref={stage}>
    {!source&&!error&&<span role="status">Abriendo foto…</span>}
    {source&&scale>0&&<div className="photo-editor-picture" style={{width:width*scale,height:height*scale}}>
     <canvas ref={preview} role="img" aria-label="Vista previa de la foto"/>
     <div className="photo-editor-mask" aria-hidden="true"><div style={{left:crop.left*scale,top:crop.top*scale,width:(crop.right-crop.left)*scale,height:(crop.bottom-crop.top)*scale}}/></div>
     {corners.map(([x,y])=><button key={x+y} type="button" className="photo-editor-handle"
      aria-label={`Ajustar esquina ${y==='top'?'superior':'inferior'} ${x==='left'?'izquierda':'derecha'}`}
      aria-describedby={hintId} style={{left:crop[x]*scale,top:crop[y]*scale}} disabled={busy}
      onPointerDown={event=>{
       if(drag.current||event.button!==0)return;
       event.currentTarget.setPointerCapture(event.pointerId);
       drag.current={pointer:event.pointerId,start:crop,x:event.clientX,y:event.clientY,scale};
      }}
      onPointerMove={event=>dragCorner(event,x,y)}
      onLostPointerCapture={event=>{if(drag.current?.pointer===event.pointerId)drag.current=null;}}
      onKeyDown={event=>{
       const step=event.shiftKey?10:1;
       const arrow={ArrowLeft:[x,-step],ArrowRight:[x,step],ArrowUp:[y,-step],ArrowDown:[y,step]}[event.key] as [Edge,number]|undefined;
       if(!arrow)return;
       event.preventDefault();
       setSelection(move(crop,arrow[0],crop[arrow[0]]+arrow[1]));
      }}><span/></button>)}
    </div>}
   </div></div>
   <div className="photo-editor-tools">
    <button type="button" className="secondary-button" aria-label="Girar a la izquierda" disabled={!source||busy} onClick={()=>rotate(-1)}><RotateCcw size={18} aria-hidden="true"/></button>
    <button type="button" className="secondary-button" aria-label="Girar a la derecha" disabled={!source||busy} onClick={()=>rotate(1)}><RotateCw size={18} aria-hidden="true"/></button>
    <button type="button" className="secondary-button" disabled={!source||busy||!selection&&!turn} onClick={()=>{setSelection(null);setTurn(0);}}>Restablecer</button>
   </div>
   {source&&<details className="photo-editor-precision"><summary>Ajuste preciso en píxeles</summary>
    <div>{(Object.keys(edges) as Edge[]).map(edge=><label key={edge}>{edges[edge]}<input type="number" inputMode="numeric" min={0} step={1} disabled={busy}
     defaultValue={crop[edge]} key={crop[edge]} onBlur={event=>{
      const position=event.currentTarget.valueAsNumber;
      const next=Number.isFinite(position)?move(crop,edge,position):crop;
      event.currentTarget.value=String(next[edge]);
      setSelection(next);
     }} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur();}}}/></label>)}</div>
   </details>}
   {error&&<p className="field-error" role="alert">{error}</p>}
  </div>
  <footer className="photo-editor-actions">
   <button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>Cancelar</button>
   <button type="button" className="primary-button" disabled={!source||busy} onClick={()=>void apply()}>{busy?'Preparando…':'Usar foto'}</button>
  </footer>
 </ReferenceDialog>;
}
