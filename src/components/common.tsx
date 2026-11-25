import { Copy, LoaderCircle } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from '../app/router';
export function ErrorNotice({ message, retry }: { message?: string; retry?: () => void }) { return message ? <div className="error-notice" role="alert"><p>{message}</p>{retry && <button className="text-button" onClick={retry}>Volver a intentar</button>}</div> : null; }
export function Loading() { return <p className="loading" role="status"><LoaderCircle size={18} className="spinner" aria-hidden="true" />Cargando...</p>; }
export function ListSkeleton() {
 return <div className="list-skeleton" role="status" aria-label="Cargando listado">
  {[0,1,2].map(row=><div key={row} aria-hidden="true"><span/><span/><span/></div>)}
 </div>;
}
export function CopyIdentifier({value,label}:{value:string;label:string}) {
 const [feedback,setFeedback]=useState<'idle'|'copied'|'failed'>('idle');
 return <span className="mobile-identifier-copy">
  <button type="button" className="secondary-button" aria-label={`Copiar ${label} ${value}`} onClick={async()=>{
   try{await navigator.clipboard.writeText(value);setFeedback('copied');}
   catch{setFeedback('failed');}
  }}><Copy size={16} aria-hidden="true"/>{feedback==='copied'?'Copiado':'Copiar'}</button>
  <span className={feedback==='failed'?'form-hint':'sr-only'} role="status">{feedback==='copied'?'Copiado':feedback==='failed'?'Selecciona el código para copiarlo.':''}</span>
 </span>;
}
export function PageHeading({ title, description, children }: { title: string; description?: string; children?: ReactNode }) { return <div className="page-heading"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{children}</div>; }
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) { return <section className="empty-state"><h2>{title}</h2>{children}</section>; }
export function Pagination({ page, size, onChange }: { page: number; size: number; onChange: (page: number) => void }) { return <div className="pagination"><button className="secondary-button" disabled={page === 0} onClick={() => onChange(page - 1)}>Anterior</button><span>Página {page + 1}</span><button className="secondary-button" disabled={size < 20} onClick={() => onChange(page + 1)}>Siguiente</button></div>; }
export const statusLabels: Record<string, string> = { COMPLETED: 'Completada', REFUNDED: 'Reembolsada', NOT_REGISTERED: 'No registrado', PARTIALLY_REGISTERED: 'Registro parcial', PENDING: 'REGISTRO PENDIENTE', PROCESSING: 'En proceso', REGISTERED: 'Registrado', REJECTED: 'Rechazado', CANCELLED: 'Cancelado', ACTIVE: 'Activo', RETURNED: 'Devuelto', BLOCKED: 'Bloqueado', ARCHIVED: 'Archivado', STORE: 'COMUNIC@TE', EXTERNAL: 'Externo', PHYSICAL: 'Físico', ESIM: 'eSIM' };
export function StatusBadge({ status }: { status: string|null }) { return <span className={`status-badge status-${(status??'none').toLowerCase()}`}>{status?statusLabels[status]??status:'SIN SOLICITUD'}</span>; }
export function formatDate(value: string) { return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)); }
export function BackLink({ to, children }: { to: string; children: ReactNode }) { return <Link to={to} className="back-link">← {children}</Link>; }
