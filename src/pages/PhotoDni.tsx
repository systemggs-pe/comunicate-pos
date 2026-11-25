import {DniPhotoType,DniPhotoGrid,DniPhotoLoading,DniPhotoEmpty,DniPhotoNotice,photoErrorMessage} from '../features/clients/DniPhotoUI';
import {useState} from 'react';
import {ScanFace,Search,LoaderCircle} from 'lucide-react';
import {useAuth} from '../app/AuthProvider';
import {Link} from '../app/router';
import {ErrorNotice} from '../components/common';
import {CodartPhotoConsent} from '../features/clients/IdentityPhotoLookup';
import {type ClientDocumentView} from '../../shared/client-documents';
import type {Client} from '../types/pos';
import '../features/clients/documents.css';
export function PhotoDniPage(){
 const {api,can}=useAuth(),[type,setType]=useState<'BLUE'|'ELECTRONIC'>('BLUE'),[dni,setDni]=useState(''),[busy,setBusy]=useState(false),[documents,setDocuments]=useState<ClientDocumentView[]>([]),[client,setClient]=useState<Client|null>(null),[confirmed,setConfirmed]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[searched,setSearched]=useState(false);
 function reset(){setDocuments([]);setClient(null);setError('');setNotice('');setSearched(false);setConfirmed(false);}
 async function lookup(){if(busy)return;if(!/^\d{8}$/.test(dni)){setError('Ingresa un DNI de ocho dígitos.');return;}setBusy(true);setError('');setNotice('');setDocuments([]);setClient(null);setSearched(true);try{
  const found=await api.get<Client>(`/clients/by-dni/${dni}`);setClient(found);
  const saved=await api.get<{documents:ClientDocumentView[]}>(`/clients/${found.id}/documents`);
  const current=saved.documents.filter(d=>d.documentType===type&&d.status==='CURRENT'&&!d.retentionDue);
  if(current.length){setDocuments(current);setNotice('Mostramos las fotos guardadas. No se usaron créditos.');return;}
  if(!can('client.identity_photo.lookup')||!can('client.documents.upload'))throw new Error('No hay fotos guardadas de este tipo. Pide al administrador que las consulte.');
  if(!confirmed)throw new Error('Marca la casilla de permiso para pedir las fotos a CODART.');
  const result=await api.post<{documents:ClientDocumentView[];reused:boolean;simulated?:boolean;creditsDeducted:number|null}>(`/clients/${found.id}/identity-photos`,{confirmed,documentType:type,refresh:false});
  setDocuments(result.documents);setNotice(result.simulated?'Estas fotos son de demostración.':result.reused?'Mostramos las fotos guardadas. No se usaron créditos.':`Fotos guardadas.${result.creditsDeducted===null?'':` Créditos usados: ${result.creditsDeducted}.`}`);
 }catch(e){setError(photoErrorMessage(e));}finally{setBusy(false);}}
 return <section className="module-panel photo-dni-page dni-photo-main"><div className="module-heading"><div className="module-heading-title"><span className="module-icon"><ScanFace size={23} aria-hidden="true"/></span><div><h1>Fotos del DNI</h1><p>Escribe el DNI para ver sus fotos.</p></div></div></div><fieldset className="dni-photo-controls" disabled={busy}><DniPhotoType value={type} onChange={value=>{reset();setType(value);}} disabled={busy}/><form className="module-toolbar dni-photo-form" onSubmit={e=>{e.preventDefault();void lookup();}}><label>Número de DNI<input aria-label="DNI de ocho dígitos" placeholder="8 dígitos" inputMode="numeric" pattern="[0-9]{8}" maxLength={8} required value={dni} onChange={e=>{reset();setDni(e.target.value.replace(/\D/g,''));}}/></label><button className="primary-button dni-photo-search" disabled={!/^\d{8}$/.test(dni)}>{busy?<LoaderCircle className="dni-photo-spinner" size={17} aria-hidden="true"/>:<Search size={17} aria-hidden="true"/>}{busy?'Buscando…':'Buscar fotos'}</button></form><p className="dni-photo-help">Primero usamos las fotos guardadas.</p>{can('client.identity_photo.lookup')&&can('client.documents.upload')&&<div className="photo-authorization"><p className="dni-photo-help">Pedir fotos a CODART puede usar créditos.</p><CodartPhotoConsent confirmed={confirmed} onConfirmed={setConfirmed} disabled={busy}/></div>}</fieldset><div className="photo-viewer"><ErrorNotice message={error}/><DniPhotoNotice message={notice}/>{searched&&!busy&&!client&&can('clients.create')&&<p className="dni-photo-next">Si es un cliente nuevo, <Link className="inline-link" to="/clientes/nuevo">agrega sus datos primero</Link>.</p>}{busy?<DniPhotoLoading/>:documents.length&&client?<DniPhotoGrid clientId={client.id} documents={documents} onSideSaved={(id,category)=>{setDocuments(previous=>previous.map(row=>row.id===id?{...row,category}:row));setNotice('Lado guardado.');}}/>:!error&&<DniPhotoEmpty searched={searched}/>}</div></section>;
}
