import {Check,IdCard,Image,LoaderCircle,CheckCircle2} from 'lucide-react';
import type {ClientDocumentView} from '../../../shared/client-documents';
import {DocumentImage} from './DocumentImage';
import {DocumentSidePicker,identitySideLabel} from './DocumentSidePicker';
export type PhotoDniType='BLUE'|'ELECTRONIC';
export function DniPhotoType({value,onChange,disabled=false}:{value:PhotoDniType;onChange:(value:PhotoDniType)=>void;disabled?:boolean}){
 return <div className="dni-photo-types" role="group" aria-label="Tipo de DNI">{(['BLUE','ELECTRONIC'] as const).map(type=><button type="button" key={type} disabled={disabled} aria-pressed={value===type} onClick={()=>onChange(type)}><IdCard size={19} aria-hidden="true"/><span>{type==='BLUE'?'DNI azul':'DNI electrónico'}</span><span className="dni-type-check" aria-hidden="true">{value===type&&<Check size={15}/>}</span></button>)}</div>;
}
export function DniPhotoLoading(){return <div className="dni-photo-state" role="status"><LoaderCircle className="dni-photo-spinner" size={26} aria-hidden="true"/><strong>Buscando las fotos…</strong><p>Espera un momento.</p></div>;}
export function DniPhotoEmpty({searched=false}:{searched?:boolean}){return <div className="dni-photo-state"><Image size={28} aria-hidden="true"/><strong>{searched?'No hay fotos para mostrar':'Las fotos aparecerán aquí'}</strong><p>{searched?'Revisa el DNI e inténtalo de nuevo.':'Ingresa el DNI y pulsa Buscar fotos.'}</p></div>;}
export function DniPhotoNotice({message}:{message:string}){return message?<p className="dni-photo-notice" role="status"><CheckCircle2 size={17} aria-hidden="true"/><span>{message}</span></p>:null;}
export function DniPhotoGrid({clientId,documents,onSideSaved}:{clientId:string;documents:ClientDocumentView[];onSideSaved:(id:string,category:'DNI_FRONT'|'DNI_BACK')=>void}){
 return <div className="document-grid dni-photo-results">{documents.map(d=><article className="dni-photo-card" key={d.id}><header><h3>{identitySideLabel(d.category)}</h3><span>{d.category==='DNI_FRONT'?'Parte de adelante':d.category==='DNI_BACK'?'Parte de atrás':`Foto ${d.sourceOrdinal??''}`}</span></header><DocumentImage path={`/clients/${clientId}/documents/${d.id}/access`} label={identitySideLabel(d.category)}/><DocumentSidePicker clientId={clientId} document={d} onSaved={category=>onSideSaved(d.id,category)}/></article>)}</div>;
}
export function photoErrorMessage(error:unknown){
 const messages:Record<string,string>={CODART_TIMEOUT:'La consulta está demorando. Inténtalo de nuevo.',CODART_AUTHORIZATION:'CODART no aceptó la consulta. Revisa la clave API y el acceso al servicio.',CODART_CREDITS:'No hay saldo disponible o se alcanzó el límite de consultas.',CLIENT_NOT_FOUND:'Este DNI aún no está registrado. Primero agrega al cliente.',CODART_STORAGE_NOT_AUTHORIZED:'Falta habilitar el guardado de fotos de CODART. Contacta al administrador.',CODART_UNAVAILABLE:'No pudimos conectar con CODART. Inténtalo en unos momentos.'};
 if(error&&typeof error==='object'&&'code' in error&&typeof error.code==='string'&&Object.hasOwn(messages,error.code))return messages[error.code];
 return error instanceof Error?error.message:'No pudimos obtener las fotos. Inténtalo de nuevo.';
}
