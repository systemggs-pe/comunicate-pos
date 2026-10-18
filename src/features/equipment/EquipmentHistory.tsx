import {History,ChevronDown} from 'lucide-react';
import {useApiQuery} from '../../hooks/useApiQuery';
import type {Equipment,HistoryEvent} from '../../types/pos';
import {ErrorNotice,formatDate,Loading} from '../../components/common';

const registrationEvents=new Set(['IMEI_REGISTRATION_STARTED','IMEI_REGISTRATION_UPDATED','IMEI_REGISTERED']);
const priority=['IMEI_REGISTRATION_STARTED','IMEI_REGISTRATION_UPDATED','IMEI_REGISTERED'];
function registrationEntry(event:HistoryEvent){
 if(!registrationEvents.has(event.eventType)||!event.imeiId)return null;
 const from=typeof event.metadata?.from==='string'?event.metadata.from:null;
 const to=typeof event.metadata?.to==='string'?event.metadata.to:null;
 if(to==='BLOCKED'&&from!=='BLOCKED')return {event,title:'Solicitud de desbloqueo recibida',detail:''};
 if(event.eventType==='IMEI_REGISTERED'||to==='REGISTERED'&&from!=='REGISTERED')return {event,title:from==='BLOCKED'||event.metadata?.action==='UNBLOCK'?'Equipo registrado y desbloqueado':'Registro completado',detail:''};
 if(event.eventType==='IMEI_REGISTRATION_STARTED')return {event,title:'Registro iniciado',detail:to==='PENDING'?'Registro pendiente':''};
 if(to==='PENDING'&&from!=='PENDING')return {event,title:'Registro pendiente',detail:''};
 return null;
}
export function EquipmentHistory({equipment,compact=false}:{equipment:Equipment;compact?:boolean}){
 const query=useApiQuery<HistoryEvent[]>(`/equipment/${equipment.id}/history`);
 const ordered=(query.data??[]).filter(event=>registrationEvents.has(event.eventType)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||priority.indexOf(a.eventType)-priority.indexOf(b.eventType)||a.id.localeCompare(b.id)).flatMap(event=>{const entry=registrationEntry(event);return entry?[entry]:[];});
 const content=<>{query.loading&&<Loading/>}<ErrorNotice message={query.error?.message} retry={query.refresh}/>{!query.loading&&!query.error&&(ordered.length?<ol className="timeline">{ordered.map(({event,title,detail})=>{const imei=equipment.imeis.find(i=>i.id===event.imeiId);return <li key={event.id}><time dateTime={event.createdAt}>{formatDate(event.createdAt)}</time><div><strong>{title}{imei?` · IMEI ${imei.slot}`:''}</strong>{detail&&<p>{detail}</p>}</div></li>;})}</ol>:<p className="muted">Aún no hay movimientos de registro.</p>)}</>;
 return compact?<details className="equipment-history-disclosure"><summary><History size={16} aria-hidden="true"/><span>Historial de registro</span>{query.data&&<small>{ordered.length}</small>}<ChevronDown className="equipment-history-chevron" size={16} aria-hidden="true"/></summary><div className="equipment-history-content">{content}</div></details>:<section className="history-section"><h2>Historial de registro</h2>{content}</section>;
}
