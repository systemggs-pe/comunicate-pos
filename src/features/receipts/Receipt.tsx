import {useState,useRef,useEffect} from 'react';
import {useAuth} from '../../app/AuthProvider';
import {useApiQuery} from '../../hooks/useApiQuery';
import {Link,navigate} from '../../app/router';
import {ErrorNotice,Loading} from '../../components/common';
import {receiptRows,receiptBarcode,type ReceiptData,type ReceiptFormat} from '../../../shared/receipt';
import './receipt.css';
function ReceiptDocument({data,format}:{data:ReceiptData;format:ReceiptFormat}){
 const margin=format===48?data.company.margin48:data.company.margin80,barcode=receiptBarcode(data.sale.code,format-margin*2);
 return <article className={`thermal-receipt receipt-${format}`} style={{width:`${format}mm`,padding:`${margin}mm`}} data-format={format} aria-label={`TICKET ${format} MM`}>
 {receiptRows(data,format).map((row,i)=><p key={i} style={{textAlign:row.align??'left',fontWeight:row.bold?700:400}}>{row.text}</p>)}
 {barcode?<svg role="img" aria-label={`CÓDIGO DE BARRAS ${data.sale.code}`} width={`${barcode.width}mm`} height="12mm" viewBox={`0 0 ${barcode.bits.length+20} 48`} preserveAspectRatio="none">{Array.from(barcode.bits).map((bit,i)=>bit==='1'?<rect key={i} x={i+10} y="0" width="1" height="48" fill="black"/>:null)}</svg>:<p className="barcode-fallback">IDENTIFICADOR EN TEXTO: EL CÓDIGO NO CABE CON DIMENSIONES LEGIBLES</p>}
 <p className="receipt-identifier">{data.sale.code}</p><p style={{textAlign:'center'}}>{data.company.receiptFooter}</p></article>;
}
export function SaleReceipt48mm({data}:{data:ReceiptData}){return <ReceiptDocument data={data} format={48}/>;}
export function SaleReceipt80mm({data}:{data:ReceiptData}){return <ReceiptDocument data={data} format={80}/>;}
export function ReceiptActions({id}:{id:string}){
 const {api}=useAuth(),dialog=useRef<HTMLDialogElement>(null);const [format,setFormat]=useState<ReceiptFormat>(48),[error,setError]=useState('');
 async function select(){setError('');try{const data=await api.get<ReceiptData>(`/sales/${encodeURIComponent(id)}/receipt`);setFormat(data.company.defaultFormat??48);dialog.current?.showModal();}catch(e){setError((e as Error).message);}}
 function open(){const url=`/ventas/${encodeURIComponent(id)}/ticket?format=${format}`;const tab=window.open(url,'_blank');dialog.current?.close();if(tab)tab.opener=null;else navigate(url);}
 return <div className="receipt-actions"><button className="secondary-button" onClick={()=>void select()}>VER TICKET</button><button className="secondary-button" onClick={()=>void select()}>IMPRIMIR</button><button className="secondary-button" onClick={()=>void select()}>DESCARGAR PDF</button><ErrorNotice message={error}/><dialog ref={dialog} className="receipt-dialog" aria-label="SELECCIONAR FORMATO DE IMPRESIÓN"><h2>SELECCIONAR FORMATO DE IMPRESIÓN</h2><label>FORMATO<select aria-label="FORMATO" value={format} onChange={e=>setFormat(Number(e.target.value) as ReceiptFormat)}><option value={48}>48 MM — TICKET COMPACTO</option><option value={80}>80 MM — TICKET ESTÁNDAR</option></select></label><p>PUEDES CAMBIAR EL FORMATO ANTES DE ABRIR EL TICKET.</p><div className="form-actions"><button className="secondary-button" onClick={()=>dialog.current?.close()}>CANCELAR</button><button className="primary-button" onClick={open}>ABRIR TICKET</button></div></dialog></div>;
}
export function SaleReceiptPreview({id}:{id:string}){
 const query=useApiQuery<ReceiptData>(`/sales/${encodeURIComponent(id)}/receipt`),raw=new URLSearchParams(window.location.search).get('format'),format:ReceiptFormat=raw==='80'?80:48;
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[pageHeight,setPageHeight]=useState(200);
 useEffect(()=>{const receipt=document.querySelector('.thermal-receipt');if(!receipt)return;const observer=new ResizeObserver(()=>setPageHeight(Math.min(1000,Math.ceil(receipt.getBoundingClientRect().height*25.4/96)+1)));observer.observe(receipt);return()=>observer.disconnect();},[query.data,format]);
 return <section className="receipt-preview"><div className="receipt-controls"><h1>TICKET {format} MM</h1><Link to={`/ventas/${id}`}>VOLVER A VENTA</Link><div className="form-actions"><button className="primary-button" disabled={!query.data} onClick={()=>window.print()}>IMPRIMIR</button><button className="secondary-button" disabled={!query.data||busy} onClick={async()=>{if(!query.data)return;setBusy(true);setError('');try{await (await import('./pdf')).downloadReceiptPdf(query.data,format);}catch{setError('NO SE PUDO GENERAR EL PDF. INTENTA NUEVAMENTE.');}finally{setBusy(false);}}}>DESCARGAR PDF</button><a href={`/ventas/${id}/ticket?format=${format===48?80:48}`}>CAMBIAR A {format===48?80:48} MM</a></div><p>EL DIÁLOGO DEL NAVEGADOR PERMITE ELEGIR LA IMPRESORA. COMPRUEBA EL RESULTADO EN EL DISPOSITIVO.</p><ErrorNotice message={query.error?.message??error}/></div>{query.loading&&<Loading/>}{query.data&&(format===48?<SaleReceipt48mm data={query.data}/>:<SaleReceipt80mm data={query.data}/>)}<style>{`@media print {@page {size:${format}mm ${pageHeight}mm;margin:0}}`}</style></section>;
}
