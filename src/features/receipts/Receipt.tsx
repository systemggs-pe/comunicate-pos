import {Printer} from 'lucide-react';
import {ReferenceDialog} from '../../components/ReferenceDialog';
import {useState,useEffect,useRef} from 'react';
import {useAuth} from '../../app/AuthProvider';
import {useApiQuery} from '../../hooks/useApiQuery';
import {Link,navigate} from '../../app/router';
import {ErrorNotice,Loading} from '../../components/common';
import {receiptRows,receiptBarcode,type ReceiptData,type ReceiptFormat} from '../../../shared/receipt';
import './receipt.css';
function ReceiptDocument({data,format}:{data:ReceiptData;format:ReceiptFormat}){
 const margin=format===48?data.company.margin48:data.company.margin80;
 return <article className={`thermal-receipt receipt-${format}`} style={{width:`${format}mm`,padding:`${margin}mm`}} data-format={format} aria-label={`TICKET ${format} MM`}>
 {receiptRows(data,format).map((row,index)=>{const barcode=row.barcode?receiptBarcode(row.barcode,format-margin*2):null;
  return <div className="receipt-row" key={index}>{barcode&&<svg role="img" aria-label={`Código de barras del número de serie ${row.barcode}`} width={`${barcode.width}mm`} height="12mm" viewBox={`0 0 ${barcode.bits.length+20} 48`} preserveAspectRatio="none">{Array.from(barcode.bits).map((bit,i)=>bit==='1'?<rect key={i} x={i+10} y="0" width="1" height="48" fill="black"/>:null)}</svg>}<p className={row.right?'receipt-columns':undefined} style={{textAlign:row.align??'left',fontWeight:row.bold?700:400}}>{row.right?<><span>{row.text}</span><span>{row.right}</span></>:row.text||'\u00a0'}</p></div>;
 })}</article>;
}
export function SaleReceipt48mm({data}:{data:ReceiptData}){return <ReceiptDocument data={data} format={48}/>;}
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
 return <div className="receipt-actions">{compact?<button className="icon-button" aria-label="Descargar ticket" title="Descargar ticket" disabled={busy} onClick={()=>void select()}><Printer size={17}/></button>:ticketOnly?<button className="secondary-button" disabled={busy} onClick={()=>void select()}><Printer size={15}/>Ticket</button>:<><button className="secondary-button" disabled={busy} onClick={()=>void select('preview')}>VER TICKET</button><button className="secondary-button" disabled={busy} onClick={()=>void select('preview')}>IMPRIMIR</button><button className="secondary-button" disabled={busy} onClick={()=>void select()}>DESCARGAR PDF</button></>}{!opened&&<ErrorNotice message={error}/>} {opened&&<ReferenceDialog label="SELECCIONAR FORMATO DE IMPRESIÓN" className="printer-picker" onClose={()=>{if(!busy)setOpened(false);}}><span className="printer-icon"><Printer size={24}/></span><h2>¿Tamaño de impresora?</h2><p>{intent==='download'?'Elige el tamaño y se descargará el ticket en PDF.':'Elige el ancho del papel de tu impresora térmica.'}</p><div className="printer-format-options"><button className="primary-button" disabled={busy} onClick={()=>void open(48)}>48 mm</button><button className="secondary-button" disabled={busy} onClick={()=>void open(80)}>80 mm</button></div>{busy&&<p role="status">Preparando el ticket…</p>}<ErrorNotice message={error}/><button className="secondary-button cancel-printer" disabled={busy} onClick={()=>setOpened(false)}>Cancelar</button></ReferenceDialog>}</div>;
}
export function SaleReceiptPreview({id}:{id:string}){
 const query=useApiQuery<ReceiptData>(`/sales/${encodeURIComponent(id)}/receipt`),raw=new URLSearchParams(window.location.search).get('format'),format:ReceiptFormat=raw==='80'?80:48;
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[pageHeight,setPageHeight]=useState(200);
 useEffect(()=>{const receipt=document.querySelector('.thermal-receipt');if(!receipt)return;const observer=new ResizeObserver(()=>setPageHeight(Math.min(1000,Math.ceil(receipt.getBoundingClientRect().height*25.4/96)+1)));observer.observe(receipt);return()=>observer.disconnect();},[query.data,format]);
 return <section className="receipt-preview"><div className="receipt-controls"><h1>TICKET {format} MM</h1><Link to={`/ventas/${id}`}>VOLVER A VENTA</Link><div className="form-actions"><button className="primary-button" disabled={!query.data} onClick={()=>window.print()}>IMPRIMIR</button><button className="secondary-button" disabled={!query.data||busy} onClick={async()=>{if(!query.data)return;setBusy(true);setError('');try{await (await import('./pdf')).downloadReceiptPdf(query.data,format);}catch{setError('NO SE PUDO GENERAR EL PDF. INTENTA NUEVAMENTE.');}finally{setBusy(false);}}}>DESCARGAR PDF</button><a href={`/ventas/${id}/ticket?format=${format===48?80:48}`}>CAMBIAR A {format===48?80:48} MM</a></div><p>EL DIÁLOGO DEL NAVEGADOR PERMITE ELEGIR LA IMPRESORA. COMPRUEBA EL RESULTADO EN EL DISPOSITIVO.</p><ErrorNotice message={query.error?.message??error}/></div>{query.loading&&<Loading/>}{query.data&&(format===48?<SaleReceipt48mm data={query.data}/>:<SaleReceipt80mm data={query.data}/>)}<style>{`@media print {@page {size:${format}mm ${pageHeight}mm;margin:0}}`}</style></section>;
}
