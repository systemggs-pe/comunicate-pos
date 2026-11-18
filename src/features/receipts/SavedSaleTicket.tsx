import {useState} from 'react';
import {ReferenceDialog} from '../../components/ReferenceDialog';
import {useApiQuery} from '../../hooks/useApiQuery';
import {ErrorNotice,Loading} from '../../components/common';
import {Link} from '../../app/router';
import {ReceiptDocument} from './Receipt';
import type {ReceiptData,ReceiptFormat} from '../../../shared/receipt';
export function SavedSaleTicket({id,onClose}:{id:string;onClose:()=>void}){
 const query=useApiQuery<ReceiptData>(`/sales/${encodeURIComponent(id)}/receipt`),[selected,setSelected]=useState<ReceiptFormat|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const format=selected??query.data?.company.defaultFormat??58;
 return <ReferenceDialog label="Ticket de venta" className="saved-sale-ticket" onClose={onClose}><header className="reference-modal-header"><p className="eyebrow">VENTA GUARDADA</p><h1>Vista previa del ticket</h1></header><div className="saved-ticket-controls"><label>Formato del ticket<select aria-label="Formato del ticket" value={format} onChange={e=>setSelected(Number(e.target.value) as ReceiptFormat)}><option value={58}>58 mm</option><option value={80}>80 mm</option></select></label><Link className="secondary-button" to={`/ventas/${id}/ticket?format=${format}`}>Imprimir ticket</Link><button className="secondary-button" disabled={!query.data||busy} onClick={async()=>{if(!query.data)return;setBusy(true);try{await(await import('./pdf')).downloadReceiptPdf(query.data,format);}catch{setError('No se pudo descargar el ticket. La venta ya está guardada.');}finally{setBusy(false);}}}>Descargar PDF</button><button className="text-button" onClick={onClose}>Cerrar ticket</button></div>{query.loading&&<Loading/>}<ErrorNotice message={query.error?.message||error} retry={query.refresh}/>{query.data&&<ReceiptDocument data={query.data} format={format}/>}</ReferenceDialog>;
}
