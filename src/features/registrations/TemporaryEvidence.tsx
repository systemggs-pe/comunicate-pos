import { useEffect, useRef, useState } from 'react';
export const evidenceCategories=['DNI frontal','DNI reverso','Caja del equipo','Boleta de venta','IMEI lógico'];
export function TemporaryEvidence({files,onChange,hasBox}:{files:Record<string,File>;onChange:(files:Record<string,File>)=>void;hasBox:boolean}) {
  return <><p>Fotos opcionales, temporales en este navegador. No se guardan ni se respaldan al confirmar.</p>{evidenceCategories.map(category=><EvidenceSlot key={category} category={category} file={files[category]} disabled={category==='Caja del equipo'&&!hasBox} onChange={file=>{const next={...files};if(file)next[category]=file;else delete next[category];onChange(next);}} />)}</>;
}
function EvidenceSlot({category,file,disabled,onChange}:{category:string;file?:File;disabled:boolean;onChange:(file?:File)=>void}) {
  const preview=useRef<HTMLImageElement>(null);const [error,setError]=useState('');
  useEffect(()=>{if(!file)return;const next=URL.createObjectURL(file);if(preview.current)preview.current.src=next;return()=>URL.revokeObjectURL(next);},[file]);
  const choose=(next?:File)=>{if(next&&(!['image/jpeg','image/png','image/webp'].includes(next.type)||next.size>8*1024*1024)){setError('Elige JPG, PNG o WEBP de hasta 8 MB.');return;}setError('');onChange(next);};
  return <section className="form-panel"><h3>{category}</h3><label>Elegir archivo: {category}<input disabled={disabled} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{choose(e.target.files?.[0]);e.target.value='';}} /></label><label>Tomar fotografía: {category}<input disabled={disabled} type="file" accept="image/*" capture="environment" onChange={e=>{choose(e.target.files?.[0]);e.target.value='';}} /></label>{disabled&&<p>Deshabilitada porque el equipo no tiene caja.</p>}{error&&<p role="alert">{error}</p>}{file&&!disabled&&<><img className="evidence-preview" ref={preview} alt={`Vista previa: ${category}`} /><p>{file.name}</p><button type="button" className="secondary-button" onClick={()=>onChange()}>Eliminar {category}</button></>}</section>;
}
