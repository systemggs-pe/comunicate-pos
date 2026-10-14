import {useEffect} from 'react';
import {useAuth} from '../../app/AuthProvider';
import {Link} from '../../app/router';
import {useApiQuery} from '../../hooks/useApiQuery';
import type {VaultData} from './DocumentVault';
import {categoryLabels,typeLabels,sourceLabels} from './IdentityPhotoLookup';
export function ClientDocumentPicker({clientId,targets,selected,onChange}:{clientId:string|null;targets:string[];selected:string[];onChange:(ids:string[])=>void}){
 const {can}=useAuth(),allowed=can('client.documents.read')&&can('registration.evidence.upload'),query=useApiQuery<VaultData>(clientId&&allowed?`/clients/${clientId}/documents`:null);
 const documents=query.data?.documents.filter(d=>d.status==='CURRENT'&&!d.retentionDue&&['DNI_FRONT','DNI_BACK'].includes(d.category))??[];
 useEffect(()=>{if(query.data&&selected.some(id=>!query.data!.documents.some(d=>d.id===id&&d.status==='CURRENT'&&!d.retentionDue&&['DNI_FRONT','DNI_BACK'].includes(d.category))))onChange(selected.filter(id=>query.data!.documents.some(d=>d.id===id&&d.status==='CURRENT'&&!d.retentionDue&&['DNI_FRONT','DNI_BACK'].includes(d.category))));},[query.data,selected,onChange]);
 if(!clientId||!allowed)return null;
 return <section className="form-panel document-picker"><h3>REUTILIZAR IDENTIDAD DEL CLIENTE</h3><p>Selecciona los documentos para las solicitudes indicadas: {targets.join(' / ')}. Las cajas y fotos de IMEI lógico permanecen en su equipo original.</p>{query.error&&<p role="alert">{query.error.message}</p>}{documents.map(d=><label key={d.id} className="checkbox-label"><input type="checkbox" checked={selected.includes(d.id)} onChange={e=>onChange(e.target.checked?[...selected.filter(id=>documents.find(doc=>doc.id===id)?.category!==d.category),d.id]:selected.filter(id=>id!==d.id))}/>REUTILIZAR {categoryLabels[d.category]} · {typeLabels[d.documentType]} · {sourceLabels[d.source]??d.source}</label>)}{query.data&&!documents.length&&<p>No hay documentos de identidad vigentes identificados para reutilizar.</p>}<Link className="inline-link" to={`/clientes/${clientId}`}>REVISAR DOCUMENTACIÓN DEL CLIENTE</Link></section>;
}
