import {useEffect,useRef,useState} from 'react';
import {operators,requestEditSchema} from '../../../shared/workflow';
import {useApi} from '../../app/ApiProvider';
import {useAuth} from '../../app/AuthProvider';
import {ErrorNotice} from '../../components/common';
import {FormValidation,ValidatedInput} from '../../components/FormValidation';
import {useFormStepFocus} from '../../hooks/useFormStepFocus';
import {useSubmit} from '../../hooks/useSubmit';
import {useUnsavedChanges} from '../../hooks/useUnsavedChanges';
import type {RegistrationRequest} from '../../types/pos';
import {displayClientName} from '../clients/displayName';
import {EquipmentFields} from '../equipment/EquipmentForm';
import {EvidenceSection} from '../evidence/EvidenceSection';
import {useEvidenceDrafts} from '../evidence/EvidenceDrafts';
import {MovistarDeclarationDraft} from '../evidence/MovistarDeclarationDraft';
import {movistarDeclarationCategory} from '../../../shared/evidence';
import {RegistrationReview} from './RegistrationReview';
import {departments,RegistrationStepper,Segmented,WizardHeader} from './RegistrationUI';
import './registration.css';

const contactFields=['phone','referencePhone','address','department','email'] as const;
const serviceFields=['operator','price','hasBox','occurredAt'] as const;
const labels={phone:'Celular de este registro',referencePhone:'Número de referencia',address:'Dirección de atención',email:'Correo de atención',price:'Precio (S/)',occurredAt:'Fecha y hora de atención'};
const statusLabels={BLOCKED:'Bloqueado',PENDING:'Registro pendiente',REGISTERED:'Registrado'};

function requestValues(request:RegistrationRequest){
 return {
  phone:request.phone,referencePhone:request.referencePhone??'',address:request.address,department:request.department,email:request.email,
  operator:request.operator,price:request.price,hasBox:request.hasBox,
  occurredAt:new Date(Date.parse(request.occurredAt)-5*60*60*1000).toISOString().slice(0,16),
 };
}
type Values=ReturnType<typeof requestValues>;
type EditableField=keyof Values;

export function RegistrationRequestEdit({request,onSaved,onCancel}:{request:RegistrationRequest;onSaved:(changed:boolean)=>void;onCancel:()=>void}){
 const {api}=useApi(),form=useRef<HTMLFormElement>(null),workspace=useRef<HTMLDivElement>(null);
 const {can}=useAuth(),declarations=useEvidenceDrafts({requestId:request.id});
 const submit=useSubmit(form);
 const [initial]=useState(()=>requestValues(request)),[value,setValue]=useState(initial);
 const [step,setStep]=useState(0),[errors,setErrors]=useState<Record<string,string>>({});
 const [evidencePending,setEvidencePending]=useState(false);
 const owner=request.applicant??request.imei?.equipment.owner,equipment=request.imei?.equipment,slot=request.imei?.slot;
 const changedFields=[...contactFields,...serviceFields].filter(field=>value[field]!==initial[field]);
 const canAddDeclaration=value.operator==='MOVISTAR'&&!request.hasMovistarDeclaration;
 const draft=declarations.drafts[`${movistarDeclarationCategory}:${request.imei?.value}`];
 const busy=submit.busy||evidencePending||(canAddDeclaration&&!!draft?.busy);
 useUnsavedChanges(changedFields.length>0||evidencePending||!!draft);
 useFormStepFocus(step,form);
 useEffect(()=>{void workspace.current?.scrollIntoView({block:'start',behavior:'instant'});},[]);

 function update<K extends EditableField>(field:K,next:Values[K]){
  setValue(previous=>({...previous,[field]:next}));
  setErrors(previous=>Object.fromEntries(Object.entries(previous).filter(([name])=>name!==field)));
 }
 function go(next:number){
  if(busy||next===step)return;
  setErrors({});
  setStep(next);
 }
 function patch(fields:readonly EditableField[]){
  return Object.fromEntries(changedFields.filter(field=>fields.includes(field)).map(field=>[
   field,field==='occurredAt'?`${value.occurredAt}:00-05:00`:value[field],
  ]));
 }
 function next(){
  const changes=patch(step===0?contactFields:step===2?serviceFields:[]);
  if(Object.keys(changes).length){
   const parsed=requestEditSchema.safeParse(changes);
   if(!parsed.success){
    setErrors(Object.fromEntries(parsed.error.issues.map(issue=>[issue.path.join('.'),issue.message])));
    const input=form.current?.elements.namedItem(String(parsed.error.issues[0].path[0]));
    if(input instanceof HTMLElement)input.focus();
    return;
   }
  }
  go(step+1);
 }
 async function save(){
  const declarationAssetId=canAddDeclaration?draft?.prepared?.assetId:undefined;
  if(!changedFields.length&&!declarationAssetId){onSaved(false);return;}
  const changes={...patch(changedFields),...(declarationAssetId?{declarationAssetId}:{})};
  const result=await submit.run(()=>api.patch<RegistrationRequest>(`/registration-requests/${request.id}`,requestEditSchema.parse(changes)));
  if(result){
   window.dispatchEvent(new Event('pos:form-saved'));
   onSaved(true);
  }
 }

 return <div ref={workspace} className="registration-workspace reference-panel">
  <WizardHeader code={request.code} onClose={onCancel} busy={busy}/>
  <RegistrationStepper step={step} error={!!Object.keys(errors).length||step===3&&!!submit.error} onBack={go} busy={busy}/>
  <div className="registration-layout">
   <FormValidation errors={errors}>
    <form ref={form} noValidate onSubmit={event=>{event.preventDefault();if(!busy){if(step===3)void save();else next();}}}>
     <fieldset disabled={submit.busy}>
      {step===0&&<section className="form-panel">
       <h2 data-step-heading tabIndex={-1}>Datos del cliente</h2>
       <div className="dni-client-fields"><div className="form-grid">
        <label>Documento<div className="document-number">
         <select aria-label="Tipo de documento" disabled value="DNI"><option>DNI</option></select>
         <input aria-label="DNI" inputMode="numeric" readOnly value={owner?.dni??''}/>
        </div></label>
        <label>Nombre Completo<input aria-label="Nombre completo" readOnly value={displayClientName(owner)}/></label>
       </div></div>
       <div className="form-grid">
        <label>Celular de este registro *<ValidatedInput aria-label={labels.phone} name="phone" inputMode="numeric" maxLength={9} required value={value.phone} onChange={event=>update('phone',event.target.value)}/></label>
        <label>N.º Referencia<ValidatedInput aria-label={labels.referencePhone} name="referencePhone" inputMode="numeric" maxLength={9} value={value.referencePhone} onChange={event=>update('referencePhone',event.target.value)}/><span className="form-hint">Si lo dejas vacío, usaremos el celular de este registro.</span></label>
        <label className="address-field">Dirección *<ValidatedInput aria-label={labels.address} name="address" maxLength={300} required value={value.address} onChange={event=>update('address',event.target.value)}/></label>
        <label className="department-field">Departamento *
         <select aria-label="Departamento" name="department" aria-invalid={!!errors.department} aria-describedby={errors.department?'edit-department-error':undefined} required value={value.department} onChange={event=>update('department',event.target.value)}>
          <option value="">SELECCIONAR DEPARTAMENTO</option>
          {value.department&&!departments.includes(value.department)&&<option>{value.department}</option>}
          {departments.map(department=><option key={department}>{department}</option>)}
         </select>
         {errors.department&&<span id="edit-department-error" className="field-error" role="alert">{errors.department}</span>}
        </label>
        <p className="combined-address"><strong>Dirección final:</strong> {value.address||'—'}{value.department&&` - ${value.department}`}</p>
        <label className="full-width">Correo Electrónico *<ValidatedInput aria-label={labels.email} name="email" type="email" required value={value.email} onChange={event=>update('email',event.target.value)}/></label>
       </div>
      </section>}
      {step===1&&<section className="form-panel">
       <h2 data-step-heading tabIndex={-1}>Datos del equipo</h2>
       {equipment&&<>
        <div className="imei-selection">
         <div className="form-grid">{[1,2].map(number=><label key={number}>IMEI {number}<input inputMode="numeric" readOnly value={equipment.imeis.find(imei=>imei.slot===number)?.value??''}/></label>)}</div>
         <p className="combined-address"><strong>IMEI de esta solicitud:</strong> {slot} · {request.imei?.value}</p>
        </div>
        <EquipmentFields registration readOnly value={equipment} onChange={()=>{}}/>
       </>}
       <p className="form-hint">{equipment?'Datos del equipo en modo de consulta.':'Los datos del equipo no están disponibles.'}</p>
      </section>}
      {step===2&&<section className="form-panel">
       <h2 data-step-heading tabIndex={-1}>Precio y condiciones del registro</h2>
       <div className="request-fields"><div className="form-grid">
        <label>Operador<select name="operator" aria-label="Operador" value={value.operator} onChange={event=>update('operator',event.target.value)}>
         {!operators.some(operator=>operator===value.operator)&&<option>{value.operator}</option>}
         {operators.map(operator=><option key={operator}>{operator}</option>)}
        </select></label>
        <label>Estado del equipo<input readOnly value={request.status==='BLOCKED'?'BLOQUEADO':'NO BLOQUEADO'}/></label>
        <label>Estado de solicitud<input readOnly value={statusLabels[request.status]}/></label>
        <label>Tipo<input readOnly value={equipment?(equipment.origin==='STORE'?'TIENDA':'EXTERNO'):''}/></label>
        <label>Precio (S/) *<ValidatedInput aria-label={labels.price} name="price" inputMode="decimal" required value={value.price} onChange={event=>update('price',event.target.value)}/></label>
        <label>Celular vinculado al IMEI{slot&&` ${slot}`}<input readOnly value={value.phone}/></label>
       </div></div>
       <Segmented label="¿Tiene caja? *" value={value.hasBox?'yes':'no'} options={[{value:'yes',label:'Sí'},{value:'no',label:'No'}]} onChange={choice=>update('hasBox',choice==='yes')}/>
       <label>Fecha y hora *<ValidatedInput type="datetime-local" aria-label={labels.occurredAt} name="occurredAt" required value={value.occurredAt} onChange={event=>update('occurredAt',event.target.value)}/></label>
      </section>}
      {step===3&&<>
       {canAddDeclaration&&request.imei&&<MovistarDeclarationDraft manager={declarations} allowed={can('registration.evidence.upload')} imei={request.imei.value} slot={request.imei.slot}/>}
       <EvidenceSection requestId={request.id} onPendingChange={setEvidencePending}/>
       {request.imei&&equipment&&<section className="form-panel">
        <RegistrationReview editing busy={busy} name={displayClientName(owner)} dni={owner?.dni??''} phone={value.phone}
         reference={value.referencePhone||value.phone} email={value.email} address={value.address} department={value.department}
         equipment={equipment} origin={equipment.origin} hasBox={value.hasBox} onEdit={go}
         requests={[{value:request.imei.value,slot:request.imei.slot,phone:value.phone,operator:value.operator,
          mode:request.status==='PENDING'?'REGISTRATION':request.status,price:value.price}]}/>
       </section>}
      </>}
      {step===3&&<ErrorNotice message={submit.error}/>}
      <div className="form-actions registration-actions mobile-workflow-actions">
       {step>0&&<button type="button" className="secondary-button" disabled={busy} onClick={()=>go(step-1)}>Atrás</button>}
       <button type="button" className="text-button" disabled={busy} onClick={onCancel}>Cancelar</button>
       <button className="primary-button" disabled={busy}>{submit.busy?'Guardando…':step===3?'Confirmar y guardar':'Siguiente'}</button>
      </div>
     </fieldset>
    </form>
   </FormValidation>
  </div>
 </div>;
}
