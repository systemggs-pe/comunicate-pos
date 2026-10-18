import './sale-preview.css';
import {SaleEdit} from './SaleEdit';
import {useState} from 'react';
import {SquarePen,CheckCircle2} from 'lucide-react';
import {useAuth,Can} from '../../app/AuthProvider';
import {navigate,Link} from '../../app/router';
import {useApiQuery} from '../../hooks/useApiQuery';
import {ReferenceDialog} from '../../components/ReferenceDialog';
import {PermanentDelete} from '../../components/PermanentDelete';
import {ErrorNotice,Loading,formatDate,StatusBadge} from '../../components/common';
import {ReceiptActions} from '../receipts/Receipt';
import {SavedSaleTicket} from '../receipts/SavedSaleTicket';
import {displayClientName} from '../clients/displayName';
import {money,paymentLabels} from './common';
import type {Sale} from '../../types/pos';
import {SalesPage} from '../../pages/Sales';
export function SaleDetailsPage({id}:{id:string}){
 const {can}=useAuth(),query=useApiQuery<Sale>(`/sales/${encodeURIComponent(id)}`);
 const [editing,setEditing]=useState(()=>can('sales.update')&&new URLSearchParams(location.search).has('edit')),[notice,setNotice]=useState(''),[ticketOpen,setTicketOpen]=useState(()=>new URLSearchParams(location.search).has('saved'));
 const sale=query.data;
 if(editing&&sale&&can('sales.update'))return <SaleEdit key={sale.id} sale={sale} onSaved={()=>{setEditing(false);setNotice('Venta actualizada.');query.refresh();navigate(`/ventas/${id}`);}} onCancel={()=>{setEditing(false);navigate(`/ventas/${id}`);}}/>;
 return <><div inert><SalesPage/></div><ReferenceDialog label="Detalle de venta" className="sale-reference-dialog sale-preview-dialog" onClose={()=>navigate('/ventas')}>{query.loading&&<Loading/>}<ErrorNotice message={query.error?.message} retry={query.refresh}/>{sale&&<><header className="reference-modal-header"><h1>{sale.code}</h1><p>{formatDate(sale.occurredAt??sale.createdAt)}</p></header><div className="sale-preview-body">{notice&&<p className="sale-preview-notice" role="status"><CheckCircle2 size={15} aria-hidden="true"/>{notice}</p>}
 <section className="sale-preview-overview" aria-label="Resumen de venta"><div><span>Total de la venta</span><strong>{money(sale.total)}</strong><p>{paymentLabels[sale.paymentMethod]}</p></div><div className="sale-preview-actions"><ReceiptActions id={id} ticketOnly/><Can permission="sales.update"><button type="button" className="secondary-button" onClick={()=>setEditing(true)}><SquarePen size={15} aria-hidden="true"/>Editar venta</button></Can></div></section>
 {!/^0(?:\.0+)?$/.test(sale.discount)&&<dl className="sale-preview-discount"><div><dt>Subtotal</dt><dd>{money(sale.subtotal??sale.total)}</dd></div><div><dt>Descuento aplicado</dt><dd>{money(sale.discount)}</dd></div></dl>}
 <section className="sale-preview-section"><h2>Cliente</h2><dl className="sale-preview-client"><div className="sale-preview-client-name"><dt>Nombre</dt><dd>{displayClientName(sale.buyer)}</dd></div><div><dt>DNI</dt><dd>{sale.buyer.dni}</dd></div>{(sale.buyerPhone||sale.buyer.phone)&&<div><dt>Celular</dt><dd>{sale.buyerPhone||sale.buyer.phone}</dd></div>}{(sale.buyerEmail||sale.buyer.email)&&<div><dt>Correo</dt><dd>{sale.buyerEmail||sale.buyer.email}</dd></div>}</dl></section>
 <section className="sale-preview-section"><div className="sale-preview-section-heading"><h2>{sale.equipment?.length===1?'Equipo vendido':'Equipos vendidos'}</h2><span>{sale.equipment?.length??0}</span></div>{sale.equipment?.map(line=><article className="sale-preview-equipment" key={line.id}><header><div><h3>{line.equipment.commercialName||`${line.equipment.brand} ${line.equipment.model}`}</h3>{can('equipment.read')?<Link className="inline-link" to={`/equipos/${line.equipment.id}`}>{line.equipment.code}</Link>:<span>{line.equipment.code}</span>}</div><strong>{money(line.unitPrice)}</strong></header><dl className="sale-preview-specs">{[['Marca',line.equipment.brand],['Modelo',line.equipment.model],['Serie',line.equipment.serialNumber],['Color',line.equipment.color],['RAM',line.equipment.ram],['Memoria',line.equipment.storage],['Origen',line.equipment.origin==='STORE'?'Tienda':'Externo'],...(line.equipment.ownerId!==sale.buyerId?[['Propietario',displayClientName(line.equipment.owner)]]:[])].filter(([,value])=>!!value).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><div className="sale-preview-imeis">{line.equipment.imeis.map(imei=><div key={imei.id}><div className="sale-preview-imei-heading"><span>IMEI {imei.slot}</span><StatusBadge status={imei.registrationStatus}/></div><p>{imei.value}</p></div>)}</div></article>)}</section>
 {!!sale.accessories?.length&&<section className="sale-preview-section"><h2>Accesorios</h2><ul className="sale-preview-accessories">{sale.accessories.map((line,index)=><li key={line.id??index}><div><strong>{line.name}</strong><span>{line.quantity} × {money(line.unitPrice)}</span></div></li>)}</ul></section>}
 <Can permission="sales.delete"><footer className="sale-preview-footer"><PermanentDelete label="Eliminar venta" path={`sales/${id}`} code={sale.code} permission="sales.delete" onDeleted={()=>navigate('/ventas')}/></footer></Can></div>{ticketOpen&&<SavedSaleTicket id={id} onClose={()=>setTicketOpen(false)}/>}</>}</ReferenceDialog></>;
}
