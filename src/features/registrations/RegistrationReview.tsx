import {ChevronDown,Pencil} from 'lucide-react';
import {cents,decimalMoney} from '../../../shared/sales';
import {money} from '../sales/common';
import type {EquipmentInput} from '../../types/pos';

interface ReviewRequest {value:string;slot:number;phone:string;operator:string;mode:'REGISTRATION'|'BLOCKED'|'REGISTERED';price:string}
interface Props {
 name:string;dni:string;phone:string;reference:string;email:string;address:string;department:string;
 equipment:EquipmentInput;origin:'STORE'|'EXTERNAL';requests:ReviewRequest[];
 attached?:number;reused?:number;hasBox:boolean;onEdit:(step:number)=>void;editing?:boolean;busy?:boolean;
}
const reviewStatus={REGISTRATION:'Registro pendiente',BLOCKED:'Bloqueado',REGISTERED:'Registrado'};
export function RegistrationReview({name,dni,phone,reference,email,address,department,equipment,origin,requests,attached,reused,hasBox,onEdit,editing=false,busy=false}:Props){
 const edit=(step:number,label:string)=>{
  const action=editing&&step===1?'Ver':'Editar';
  return <button type="button" className="text-button review-edit" aria-label={`${action} ${label}`} disabled={busy} onClick={()=>onEdit(step)}>{action==='Editar'&&<Pencil size={14} aria-hidden="true"/>}{action}</button>;
 };
 const total=requests.length===1?requests[0].price:decimalMoney(requests.reduce((sum,row)=>sum+cents(row.price),0n));
 return <details className="final-review registration-review-panel">
  <summary><span className="review-summary-title">Resumen del registro</span><span className="review-summary-meta">{requests.length===2?'2 solicitudes':'1 solicitud'}</span><ChevronDown size={18} aria-hidden="true"/></summary>
  <div className="registration-review review-content">
   <section className="review-person" aria-label="Resumen del cliente">
    <div className="review-section-heading"><h3>Cliente</h3>{edit(0,'cliente')}</div><p className="review-primary">{name}</p>
    <dl className="review-facts"><div><dt>DNI</dt><dd>{dni}</dd></div><div><dt>Celular</dt><dd>{phone}</dd></div><div><dt>Referencia</dt><dd>{reference}</dd></div><div><dt>Correo</dt><dd>{email}</dd></div><div className="review-fact-wide"><dt>Dirección</dt><dd>{[address,department].filter(Boolean).join(' · ')}</dd></div></dl>
   </section>
   <section className="review-device" aria-label="Resumen del equipo">
    <div className="review-section-heading"><h3>Equipo</h3>{edit(1,'equipo')}</div><p className="review-primary">{[equipment.brand,equipment.commercialName||equipment.model].filter(Boolean).join(' ')}</p>
    <dl className="review-facts"><div><dt>Modelo</dt><dd>{equipment.model}</dd></div><div><dt>Origen</dt><dd>{origin==='STORE'?'Tienda':'Externo'}</dd></div>{equipment.serialNumber&&<div className="review-fact-wide"><dt>Número de serie</dt><dd>{equipment.serialNumber}</dd></div>}</dl>
   </section>
   <section className="review-requests" aria-label="Resumen de solicitudes">
    <div className="review-section-heading"><h3>{requests.length===2?'Solicitudes por IMEI':'Solicitud por IMEI'}</h3>{edit(2,'registro')}</div>
    <div className="review-request-list">{requests.map(row=><div className="review-request-row" key={row.value}>
     <div className="review-imei"><span>IMEI {row.slot}</span><strong>{row.value}</strong><span className={row.mode==='BLOCKED'?'review-status-blocked':row.mode==='REGISTERED'?'status-badge status-registered':'review-status-pending'}>{reviewStatus[row.mode]}</span></div>
     <dl><div><dt>Celular</dt><dd>{row.phone}</dd></div><div><dt>Operador</dt><dd>{row.operator}</dd></div></dl><strong className="review-price">{money(row.price)}</strong>
    </div>)}</div>
    <div className="review-total"><span>Total de servicios</span><strong>{money(total)}</strong></div>
   </section>
   <section className="review-documents" aria-label="Resumen de documentación">
    <div className="review-section-heading"><h3>Documentación</h3>{!editing&&edit(3,'documentación')}</div>
    <dl className="review-document-counts">{attached!==undefined&&<div><dt>Fotos adjuntas</dt><dd>{attached}</dd></div>}{reused!==undefined&&<div><dt>Documentos reutilizados</dt><dd>{reused}</dd></div>}<div><dt>Caja del equipo</dt><dd>{hasBox?'Sí tiene':'Sin caja'}</dd></div></dl>
    <p className="review-document-note">{editing?'Las fotos se gestionan en el paso Evidencias.':<>{requests.length===2?'Las fotos adjuntas se comparten entre ambos IMEI. ':''}El DNI se conserva para próximos trámites. Cada solicitud tiene su expediente PDF.</>}</p>
   </section>
  </div>
 </details>;
}
