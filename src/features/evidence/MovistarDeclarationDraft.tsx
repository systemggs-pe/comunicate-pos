import {FileUp} from 'lucide-react';
import {evidenceLabels,movistarDeclarationCategory} from '../../../shared/evidence';
import type {useEvidenceDrafts} from './EvidenceDrafts';

export function MovistarDeclarationDraft({manager,allowed,imei,slot}:{manager:ReturnType<typeof useEvidenceDrafts>;allowed:boolean;imei:string;slot:number}){
 const key=`${movistarDeclarationCategory}:${imei}`;
 const draft=manager.drafts[key];
 const headingId=`movistar-declaration-heading-${slot}`;
 const helpId=`movistar-declaration-help-${slot}`;
 return <section className="form-panel" aria-labelledby={headingId}>
  <article className="evidence-card">
   <div className="evidence-card-heading">
    <h3 id={headingId}>{evidenceLabels[movistarDeclarationCategory]} · IMEI {slot}</h3>
    {draft?.prepared&&!draft.busy&&<span className="status-badge status-registered" role="status">Validada</span>}
   </div>
   <p className="evidence-description" id={helpId}>{imei} · PDF obligatorio.</p>
   {allowed?<div className="evidence-actions"><label className="secondary-button" aria-disabled={draft?.busy}>
    <FileUp size={16} aria-hidden="true"/>{draft?'Reemplazar PDF':'Subir PDF'}
    <input type="file" accept="application/pdf,.pdf" aria-label={`Subir declaración jurada de Movistar para IMEI ${slot}`} aria-describedby={helpId}
     disabled={draft?.busy} onChange={event=>{
      const file=event.target.files?.[0];
      if(file)void manager.choose(movistarDeclarationCategory,imei,file);
      event.target.value='';
     }}/>
   </label></div>:<p className="form-hint">Tu rol necesita permiso para adjuntar la declaración.</p>}
   {draft?.busy&&<p role="status">{draft.progress===100?'Validando PDF…':`Cargando PDF… ${draft.progress}%`}</p>}
   {draft?.error&&<p className="field-error" role="alert">{draft.error}</p>}
   {draft?.prepared&&<p className="evidence-description">{draft.file.name}</p>}
  </article>
 </section>;
}
