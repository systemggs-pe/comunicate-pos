import {Printer} from 'lucide-react';
import {ReferenceDialog} from '../../components/ReferenceDialog';
import {useState,useEffect,useRef} from 'react';
import {useAuth} from '../../app/AuthProvider';
import {useApiQuery} from '../../hooks/useApiQuery';
import {Link,navigate} from '../../app/router';
import {ErrorNotice,Loading} from '../../components/common';
import {receiptLayout,type ReceiptData,type ReceiptFormat} from '../../../shared/receipt';
import './receipt.css';
export function ReceiptDocument({data,format}:{data:ReceiptData;format:ReceiptFormat}){
 const layout=receiptLayout(data,format),{margin,width,scale}=layout;
 return <article className={`thermal-receipt receipt-${format}`} style={{width:`${format}mm`,height:`${layout.height}mm`}} data-format={format} aria-label={`Ticket ${format} mm`}>
 {layout.logo&&<img src={layout.logo.dataUrl} alt="Logo de la empresa" style={{position:'absolute',left:`${layout.logo.x}mm`,top:`${layout.logo.y}mm`,width:`${layout.logo.width}mm`,height:`${layout.logo.height}mm`}}/>}
 {layout.items.map((item,index)=>{const {row,y,baseline,font,rightFont,lines,lineHeight,barcode,inset,labelWidth}=item;
  const textTop=baseline-y-font*25.4/72*.805;
  return <div className={`receipt-row receipt-row-${row.kind??'text'}`} style={{left:`${margin}mm`,top:`${y}mm`,width:`${width}mm`,height:`${item.height}mm`}} key={index}>
   {row.kind==='section'&&<><span className="receipt-rule"/><span className="receipt-section-band" style={{top:`${scale}mm`,height:`${5.6*scale}mm`}}/></>}
   {row.kind==='rule'&&<span className="receipt-rule"/>}
   {row.kind==='total'&&<span className="receipt-total-band"/>}
   {barcode&&<svg role="img" aria-label={`Código de barras del número de serie ${row.barcode}`} width={`${barcode.width}mm`} height={`${12*scale}mm`} viewBox={`0 0 ${barcode.bits.length+20} 48`} preserveAspectRatio="none">{Array.from(barcode.bits).map((bit,i)=>bit==='1'?<rect key={i} x={i+10} y="0" width="1" height="48" fill="black"/>:null)}</svg>}
   {row.kind!=='rule'&&<>
    {row.label&&<p className="receipt-field-label" style={{top:`${textTop}mm`,fontSize:`${font}pt`,color:'#585858'}}>{row.label}</p>}
    <p style={{top:`${textTop}mm`,left:`${labelWidth+inset+(row.kind==='section'?1.4*scale:0)}mm`,right:`${inset}mm`,fontSize:`${font}pt`,lineHeight:`${lineHeight}mm`,textAlign:row.align??'left',fontWeight:row.bold?700:400,color:row.kind==='field'?'#121212':`rgb(${row.color??18},${row.color??18},${row.color??18})`}}>{lines.map((line,i)=><span className="receipt-text-line" key={i}>{line}</span>)}</p>
    {row.right&&<p className="receipt-right" style={{top:`${baseline-y-rightFont*25.4/72*.805}mm`,right:`${inset}mm`,fontSize:`${rightFont}pt`,fontWeight:row.bold?700:400}}>{row.right}</p>}
   </>}
  </div>;
 })}</article>;
}
export function SaleReceipt58mm({data}:{data:ReceiptData}){return <ReceiptDocument data={data} format={58}/>;}
export function SaleReceipt80mm({data}:{data:ReceiptData}){return <ReceiptDocument data={data} format={80}/>;}
export function ReceiptActions({id,compact=false,ticketOnly=false}:{id:string;compact?:boolean;ticketOnly?:boolean}){
 const {api}=useAuth(),[opened,setOpened]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[intent,setIntent]=useState<'download'|'preview'>('download');
 const downloadLock=useRef(false);
 async function select(mode:'download'|'preview'='download'){if(busy)return;setError('');setBusy(true);try{await api.get<ReceiptData>(`/sales/${encodeURIComponent(id)}/receipt`);setIntent(mode);setOpened(true);}catch(e){setError(e instanceof Error?e.message:'No se pudo abrir el selector.');}finally{setBusy(false);}}
 async function open(format:ReceiptFormat){
  if(busy||downloadLock.current)return;
  if(intent==='preview'){const url=`/ventas/${encodeURIComponent(id)}/ticket?format=${format}`;const tab=window.open(url,'_blank');setOpened(false);if(tab)tab.opener=null;else navigate(url);return;}
  downloadLock.current=true;setBusy(true);setError('');
  try{const data=await api.get<ReceiptData>(`/sales/${encodeURIComponent(id)}/receipt`);await(await import('./pdf')).downloadReceiptPdf(data,format);setOpened(false);}
  catch(e){setError(e instanceof Error?e.message:'No se pudo descargar el ticket. Inténtalo de nuevo.');}
  finally{downloadLock.current=false;setBusy(false);}
 }
 return <div className="receipt-actions">{compact?<button className="icon-button" aria-label="Descargar ticket" title="Descargar ticket" disabled={busy} onClick={()=>void select()}><Printer size={17}/></button>:ticketOnly?<button className="secondary-button" disabled={busy} onClick={()=>void select()}><Printer size={15}/>Ticket</button>:<><button className="secondary-button" disabled={busy} onClick={()=>void select('preview')}>VER TICKET</button><button className="secondary-button" disabled={busy} onClick={()=>void select('preview')}>IMPRIMIR</button><button className="secondary-button" disabled={busy} onClick={()=>void select()}>DESCARGAR PDF</button></>}{!opened&&<ErrorNotice message={error}/>} {opened&&<ReferenceDialog label="SELECCIONAR FORMATO DE IMPRESIÓN" className="printer-picker" mobile="sheet" onClose={()=>{if(!busy)setOpened(false);}}><span className="printer-icon"><Printer size={24}/></span><h2>¿Tamaño de impresora?</h2><p>{intent==='download'?'Elige el tamaño y se descargará el ticket en PDF.':'Elige el ancho del papel de tu impresora térmica.'}</p><div className="printer-format-options"><button className="primary-button" disabled={busy} onClick={()=>void open(58)}>58 mm</button><button className="secondary-button" disabled={busy} onClick={()=>void open(80)}>80 mm</button></div>{busy&&<p role="status">Preparando el ticket…</p>}<ErrorNotice message={error}/><button className="secondary-button cancel-printer" disabled={busy} onClick={()=>setOpened(false)}>Cancelar</button></ReferenceDialog>}</div>;
}
export function SaleReceiptPreview({id}:{id:string}){
 const query=useApiQuery<ReceiptData>(`/sales/${encodeURIComponent(id)}/receipt`),raw=new URLSearchParams(window.location.search).get('format'),format:ReceiptFormat=raw==='80'?80:58;
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[pageHeight,setPageHeight]=useState(200);
 useEffect(()=>{const receipt=document.querySelector('.thermal-receipt');if(!receipt)return;const observer=new ResizeObserver(()=>setPageHeight(Math.min(1000,Math.ceil(receipt.getBoundingClientRect().height*25.4/96)+1)));observer.observe(receipt);return()=>observer.disconnect();},[query.data,format]);
 return <section className="receipt-preview"><div className="receipt-controls"><h1>TICKET {format} MM</h1><Link to={`/ventas/${id}`}>VOLVER A VENTA</Link><div className="form-actions"><button className="primary-button" disabled={!query.data} onClick={()=>window.print()}>IMPRIMIR</button><button className="secondary-button" disabled={!query.data||busy} onClick={async()=>{if(!query.data)return;setBusy(true);setError('');try{await (await import('./pdf')).downloadReceiptPdf(query.data,format);}catch{setError('NO SE PUDO GENERAR EL PDF. INTENTA NUEVAMENTE.');}finally{setBusy(false);}}}>DESCARGAR PDF</button>{([58,80] as const).filter(size=>size!==format).map(size=><a key={size} href={`/ventas/${id}/ticket?format=${size}`}>Cambiar a {size} mm</a>)}</div><p>EL DIÁLOGO DEL NAVEGADOR PERMITE ELEGIR LA IMPRESORA. COMPRUEBA EL RESULTADO EN EL DISPOSITIVO.</p><ErrorNotice message={query.error?.message??error}/></div>{query.loading&&<Loading/>}{query.data&&<ReceiptDocument data={query.data} format={format}/>}<style>{`@media print {@page {size:${format}mm ${pageHeight}mm;margin:0}}`}</style></section>;
}
