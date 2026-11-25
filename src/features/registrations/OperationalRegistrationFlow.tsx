import {RegistrationDniExtraction,type DniChoice,type DniSide} from './RegistrationDniExtraction';
import {isValidImeiLuhn} from '../../../shared/imei';
import {useEffect,useRef,useState} from 'react';
import {z} from 'zod';
import {Smartphone,CheckCircle2} from 'lucide-react';
import {useApi} from '../../app/ApiProvider';
import {useAuth} from '../../app/AuthProvider';
import {navigate} from '../../app/router';
import {useDniLookup} from '../../hooks/useDniLookup';
import {useEquipmentIdentity} from '../../hooks/useEquipmentIdentity';
import {useUnsavedChanges} from '../../hooks/useUnsavedChanges';
import {useSubmit} from '../../hooks/useSubmit';
import {useApiQuery} from '../../hooks/useApiQuery';
import {useFormStepFocus} from '../../hooks/useFormStepFocus';
import {FormValidation,FieldScope,ValidatedInput} from '../../components/FormValidation';
import {ErrorNotice,StatusBadge} from '../../components/common';
import {ClientDocumentPicker,type RegistrationIdentityState} from '../clients/ClientDocumentPicker';
import {InlineIdentityDocuments} from '../clients/InlineIdentityDocuments';
import {asClientInput,emptyClient} from '../clients/ClientFields';
import {BoxScanner} from '../equipment/BoxScanner';
import {EquipmentFields} from '../equipment/EquipmentForm';
import {EvidenceDrafts,useEvidenceDrafts} from '../evidence/EvidenceDrafts';
import {MovistarDeclarationDraft} from '../evidence/MovistarDeclarationDraft';
import {movistarDeclarationCategory} from '../../../shared/evidence';
import {RegistrationSuccess} from '../evidence/EvidencePdfAction';
import {RegistrationStepper,WizardHeader,Segmented,departments} from './RegistrationUI';
import {operationalRegistrationSchema,operators,requestFieldsSchema,phoneSchema} from '../../../shared/workflow';
import {clientSchema,imeiListSchema,equipmentEditSchema} from '../../../shared/validation';
import {normalizeTypedText,normalizeEmail} from '../../../shared/normalization';
import {limaDateTimeNow,limaDateTimeIso} from '../../../shared/operational-date';
import {RegistrationReview} from './RegistrationReview';
import {RegistrationReceiptPanel,useRegistrationReceipt} from './RegistrationReceipt';
import {ApiError} from '../../services/api';
import type {Equipment,EquipmentInput,ImeiInput,RegistrationRequest,RegistrationResolution} from '../../types/pos';
import './registration.css';
const blankEquipment:EquipmentInput={brand:'',model:'',commercialName:'',serialNumber:'',color:'',ram:'',storage:''};
const blankImeis=():ImeiInput[]=>[{slot:1,value:'',type:'PHYSICAL'},{slot:2,value:'',type:'PHYSICAL'}];
const emptyContact={phone:null as string|null,referencePhone:'',address:null as string|null,department:null as string|null,province:null as string|null,email:null as string|null};
const clientName=(c:{fullName?:string|null;firstName:string;lastName:string})=>c.fullName||[c.firstName,c.lastName].filter(Boolean).join(' ');
export function OperationalRegistrationFlow(){
 const {api}=useApi(),{can}=useAuth(),submit=useSubmit(),form=useRef<HTMLFormElement>(null);
 const [step,setStep]=useState(0),[draft,setDraft]=useState({...emptyClient,fullName:''}),[manualEquipment,setEquipment]=useState(blankEquipment),[enteredContact,setContact]=useState(emptyContact);
 const lookup=useDniLookup(draft,value=>setDraft({...value,fullName:value.fullName??''}));
 const name=clientName(draft);
 const contact={...enteredContact,phone:enteredContact.phone??lookup.localClient?.phone??draft.phone,email:enteredContact.email??lookup.localClient?.email??draft.email,address:enteredContact.address??lookup.localClient?.address??draft.address,department:enteredContact.department??lookup.localClient?.department??draft.department,province:enteredContact.province??lookup.localClient?.province??draft.province};
 const client={...asClientInput({...draft,...contact,fullName:name}),fullName:name};
 const reference=contact.referencePhone||contact.phone;
 const [imeis,setImeis]=useState<ImeiInput[]>(blankImeis),identity=useEquipmentIdentity(imeis);
 const [chosenEquipment,setChosenEquipment]=useState<Equipment|null>(null);
 const found=identity.equipment??chosenEquipment;
 const equipment:EquipmentInput=found?{brand:found.brand,model:found.model,commercialName:found.commercialName,serialNumber:found.serialNumber,color:found.color,ram:found.ram,storage:found.storage}:manualEquipment;
 const linked=useApiQuery<Equipment[]>(lookup.localClient?`/equipment?ownerId=${lookup.localClient.id}&limit=100`:null);
 const [selected,setSelected]=useState<string[]>([]),[both,setBoth]=useState(false),[confirmed,setConfirmed]=useState(false),[resolution,setResolution]=useState<RegistrationResolution|null>(null);
 const [details,setDetails]=useState<Record<string,{phone:string;operator:typeof operators[number];mode:'REGISTRATION'|'BLOCKED';price:string}>>({});
 const [confirmedOperators,setConfirmedOperators]=useState<Record<string,string>>({});
 const operatorsConfirmed=selected.length>0&&selected.every(value=>!!details[value]&&confirmedOperators[value]===details[value].operator);
 const movistarImeis=selected.filter(value=>details[value]?.operator==='MOVISTAR');
 const [hasBox,setHasBox]=useState(true),[origin,setOrigin]=useState<'STORE'|'EXTERNAL'>('EXTERNAL'),[date,setDate]=useState(limaDateTimeNow),[operationKey]=useState(()=>crypto.randomUUID());
 const evidence=useEvidenceDrafts(operationKey),[identityState,setIdentityState]=useState<RegistrationIdentityState>({clientId:null,ids:[],categories:[],loading:true,error:''}),[saved,setSaved]=useState<{requests:RegistrationRequest[]}|null>(null),[errors,setErrors]=useState<Record<string,string>>({});
 const declarationUploading=movistarImeis.some(imei=>evidence.drafts[`${movistarDeclarationCategory}:${imei}`]?.busy);
 const photoDrafts=Object.values(evidence.drafts).filter(draft=>draft.category!==movistarDeclarationCategory&&selected.includes(draft.value));
 const evidenceBusy=photoDrafts.some(draft=>draft.busy);
 const evidenceInvalid=photoDrafts.some(draft=>!draft.prepared&&!["DNI_FRONT","DNI_BACK"].includes(draft.category));
 const [receiptFilePending,setReceiptFilePending]=useState(false);
 const hasReceiptUpload=Object.values(evidence.drafts).some(row=>row.category==='PURCHASE_RECEIPT'&&!!row.prepared&&selected.includes(row.value));
 const canAttachReceipt=can('registration.evidence.upload')&&can('registration.evidence.read');
 const receipt=useRegistrationReceipt(resolution&&canAttachReceipt?{dni:client.dni,imeis,equipmentId:resolution.equipment?.id}:null,hasReceiptUpload);
 const dateEdited=useRef(false);
 useEffect(()=>{let active=true;void api.get<{serverTime:string}>('/server-time').then(result=>{if(active&&!dateEdited.current){const server=new Date(result.serverTime);setDate(new Date(server.getTime()-5*60*60*1000).toISOString().slice(0,16));}}).catch(()=>undefined);return()=>{active=false;};},[api]);
 const requested=useRef(new URLSearchParams(window.location.search));
 useEffect(()=>{const id=requested.current.get('clientId');if(!id)return;const controller=new AbortController();void api.get<import('../../types/pos').Client>(`/clients/${encodeURIComponent(id)}`,controller.signal).then(c=>{if(!controller.signal.aborted&&c.dni)setDraft({...emptyClient,fullName:'',dni:c.dni});}).catch(()=>undefined);return()=>controller.abort();},[api]);
 const [createdIdentityClient,setCreatedIdentityClient]=useState<{dni:string;id:string}|null>(null);
 const [identityChoices,setIdentityChoices]=useState<DniChoice[]>([]);
 const activeDni=useRef(draft.dni);
 const localId=lookup.localClient?.id??(createdIdentityClient?.dni===draft.dni?createdIdentityClient.id:undefined);
 const currentIdentity=identityState.clientId===localId?identityState.current??[]:[];
 async function ensureIdentityClient(){
  const dni=client.dni;
  const saved=await api.post<{id:string}>('/clients',clientSchema.parse(client));
  if(activeDni.current!==dni)throw Error('Cambió el DNI del registro.');
  setCreatedIdentityClient({dni,id:saved.id});
  return saved.id;
 }
 function chooseIdentity(choice:DniChoice){
  if(choice.documentId)for(const [key,item] of Object.entries(evidence.drafts)){
   if(item.category===choice.category)evidence.remove(key);
  }
  setIdentityChoices(previous=>[...previous.filter(item=>item.category!==choice.category&&(!choice.documentId||item.documentId!==choice.documentId)),choice]);
 }
 function removeIdentity(side:DniSide){setIdentityChoices(previous=>previous.filter(item=>item.category!==side));}
 const selectedIdentityChanges=identityChoices.filter(choice=>choice.documentId||Object.values(evidence.drafts).some(item=>item.category===choice.category&&item.prepared));
 const identityDocuments=identityState.clientId===(localId??null)?identityState.ids.filter((_,index)=>!selectedIdentityChanges.some(choice=>choice.category===identityState.categories[index])):[];
 const savedIdentityCategories=identityState.clientId===(localId??null)?identityState.categories:[];
 const identityLoading=!!localId&&can('client.documents.read')&&can('registration.evidence.upload')&&(identityState.clientId!==localId||identityState.loading);

 useFormStepFocus(step,form);useUnsavedChanges(!saved&&!!draft.dni);
 const entered=imeis.filter(i=>isValidImeiLuhn(i.value));
 const candidates=found?[...found.imeis,...entered.filter(i=>!found.imeis.some(known=>known.value===i.value))]:entered;
 const blocked=(value:string)=>!isValidImeiLuhn(value)||!!found?.imeis.some(i=>i.value===value&&['BLOCKED','PENDING','REGISTERED'].includes(i.registrationStatus??''));
 const validBoth=candidates.length===2&&candidates.every(i=>!blocked(i.value)&&isValidImeiLuhn(i.value))&&candidates[0].value!==candidates[1].value;
 const secondImei=candidates.find(imei=>imei.slot===2);
 const secondPhone=secondImei?details[secondImei.value]?.phone??'':'';
 function go(index:number){setErrors({});setStep(index);}
 function changeImeis(next:ImeiInput[]){evidence.clear();setConfirmedOperators({});setImeis(next);if(found)setEquipment(blankEquipment);setChosenEquipment(null);setSelected([]);setBoth(false);setResolution(null);setConfirmed(false);setErrors({});}
 function selectEquipment(value:Equipment){evidence.clear();setConfirmedOperators({});setImeis(value.imeis.map(i=>({slot:i.slot,value:i.value,type:i.type})));setChosenEquipment(value);setSelected([]);setBoth(false);setResolution(null);setConfirmed(false);setEquipment(blankEquipment);}
 function newEquipment(){changeImeis(blankImeis());setEquipment(blankEquipment);}
 function resetDni(dni:string){activeDni.current=dni;setCreatedIdentityClient(null);setIdentityChoices([]);evidence.clear();setConfirmedOperators({});setDraft({...emptyClient,fullName:'',dni});setContact(emptyContact);setImeis(blankImeis());setChosenEquipment(null);setSelected([]);setBoth(false);setEquipment(blankEquipment);setResolution(null);setIdentityState({clientId:null,ids:[],categories:[],loading:true,error:''});setDetails({});setErrors({});}
 function fieldError(key:string){return errors[key]?<span className="field-error" id={`error-${key}`} role="alert">{errors[key]}</span>:null;}
 function fail(error:unknown){
  if(error instanceof z.ZodError){
   const labels:Record<string,string>={dni:'DNI',fullName:'Nombre del cliente',firstName:'Nombres',lastName:'Apellidos',phone:'Celular de este registro',referencePhone:'Número de referencia',address:'Dirección',department:'Departamento',email:'Correo de atención','equipment.brand':'Marca del equipo','equipment.model':'Modelo del equipo','equipment.commercialName':'Nombre del equipo','equipment.serialNumber':'Número de serie','equipment.color':'Color del equipo','equipment.ram':'RAM del equipo','equipment.storage':'Memoria del equipo',secondPhone:'Celular del IMEI 2'};
   const issues=error.issues.map(issue=>{const key=issue.path.join('.'),request=key.match(/^requests\.(\d+)\.(.+)$/),imei=key.match(/^imeis\.(\d+)\.value$/);const requestLabels:Record<string,string>={phone:'Celular',price:'Precio',operator:'Operador',address:'Dirección',department:'Departamento',email:'Correo',occurredAt:'Fecha y hora'};const label=labels[key]??(request?`${requestLabels[request[2]]??request[2]} del IMEI ${imeis.find(i=>i.value===selected[Number(request[1])])?.slot??Number(request[1])+1}`:imei?`IMEI ${Number(imei[1])+1}`:undefined);return {...issue,message:label?`${label}: ${issue.message}`:issue.message};});
   const fields:Record<string,string>={};for(const issue of issues)fields[issue.path.join('.')]=issue.message;
   setErrors(fields);const first=Object.keys(fields)[0];
   // Bring errors from a previous step back into view without clearing entered values.
   const firstStep=first.startsWith('equipment.')||first.startsWith('imeis.')||first==='secondPhone'?1:labels[first]!==undefined&&first!=='secondPhone'?0:step;
   if(firstStep<step)setStep(firstStep);
   requestAnimationFrame(()=>form.current?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus());
   throw new z.ZodError(issues);
  }
  throw error;
 }
 function makeInput(includeReceipt=false){
  const receiptChoice=includeReceipt?receipt.choice:undefined;
  const correction=lookup.localClient&&name!==clientName(lookup.localClient)?{clientId:lookup.localClient.id,expectedName:clientName(lookup.localClient),fullName:name}:undefined;
  const evidenceLinks=evidence.links(selected).filter(row=>{
   if(row.category===movistarDeclarationCategory)return includeReceipt&&movistarImeis.includes(row.imeiValues[0]);
   const identityChoice=identityChoices.find(choice=>choice.category===row.category);
   return !identityChoice?.documentId&&(!savedIdentityCategories.includes(row.category)||!!identityChoice)&&(!receiptChoice||row.category!=='PURCHASE_RECEIPT');
  }).map(row=>row.category==='DNI_FRONT'||row.category==='DNI_BACK'?{...row,imeiValues:selected}:row);
  return operationalRegistrationSchema.parse({idempotencyKey:operationKey,identityChanges:includeReceipt&&selectedIdentityChanges.length?selectedIdentityChanges:undefined,requireReceipt:includeReceipt&&canAttachReceipt?true:undefined,clientNameCorrection:correction,receipt:receiptChoice,documentEvidence:identityDocuments.map(documentId=>({documentId,imeiValues:selected})),evidence:evidenceLinks,client:{...client,phone:contact.phone,email:contact.email,address:contact.address,department:contact.department,province:contact.province},imeis,origin:resolution?.equipment?.origin??found?.origin??origin,expectedEquipmentId:resolution?.equipment?.id,equipment:resolution?.equipment?undefined:{...equipment,serialNumber:equipment.serialNumber?.trim()||null},confirmAddImei:confirmed,requests:selected.map(value=>({...details[value],value,referencePhone:reference,address:contact.address,department:contact.department,province:contact.province,email:contact.email,hasBox,occurredAt:limaDateTimeIso(date)}))});
 }
 async function next(){setErrors({});await submit.run(async()=>{try{
  if(step===0){if(lookup.loading)throw Error('ESPERA LA CONSULTA DNI O ELIGE INGRESO MANUAL.');clientSchema.parse(client);requestFieldsSchema.pick({phone:true,address:true,department:true,province:true,email:true,referencePhone:true}).parse({...contact,referencePhone:reference});setStep(1);}
  if(step===1){
   if(identity.loading||identity.error)throw Error(identity.error??'ESPERA LA BÚSQUEDA DEL EQUIPO.');
   const normalized=z.object({imeis:imeiListSchema}).parse({imeis}).imeis;
   if(both){const phones=z.object({secondPhone:phoneSchema}).superRefine((value,ctx)=>{const first=candidates.find(imei=>imei.slot===1);if(value.secondPhone===(first?details[first.value]?.phone??contact.phone:contact.phone))ctx.addIssue({code:'custom',path:['secondPhone'],message:'El celular del IMEI 2 debe ser distinto del IMEI 1.'});});phones.parse({secondPhone});}
   const result=await api.post<RegistrationResolution>('/registrations/resolve',{dni:client.dni,imeis:normalized});
   if(chosenEquipment&&chosenEquipment.id!==result.equipment?.id)throw Error('EL EQUIPO CAMBIÓ. VUELVE A SELECCIONARLO.');
   const canonical=result.equipment?[...result.equipment.imeis,...result.additions]:normalized;
   if(!selected.length||both&&selected.length!==2)throw Error('SELECCIONA EL IMEI QUE DESEAS REGISTRAR.');
   if(selected.some(v=>!canonical.some(i=>i.value===v)||result.equipment?.imeis.some(i=>i.value===v&&['BLOCKED','PENDING','REGISTERED'].includes(i.registrationStatus??''))))throw Error('EL IMEI SELECCIONADO YA TIENE UNA SOLICITUD.');
   if(!result.equipment&&!equipment.commercialName?.trim())throw new z.ZodError([{code:'custom',path:['equipment','commercialName'],message:'COMPLETE EL NOMBRE COMERCIAL.'}]);
   if(!result.equipment)z.object({equipment:equipmentEditSchema}).parse({equipment:{...equipment,serialNumber:equipment.serialNumber?.trim()||null}});
   if(result.requiresConfirmation&&!confirmed)throw Error('CONFIRMA QUE EL IMEI ADICIONAL PERTENECE AL MISMO EQUIPO.');
   setResolution(result);setImeis(canonical.map(i=>({slot:i.slot,value:i.value,type:i.type??'PHYSICAL'})));
   setDetails(previous=>Object.fromEntries(selected.map((v,index)=>[v,previous[v]??{phone:both?canonical.find(imei=>imei.value===v)?.slot===1?contact.phone:'':index===0?contact.phone:'',operator:'BITEL',mode:'REGISTRATION',price:'0'}])));setStep(2);
  }
  if(step===2){if(!operatorsConfirmed)return;makeInput();setStep(3);}
 }catch(e){fail(e);}});}
 async function save(){setErrors({});const result=await submit.run(async()=>{try{if(declarationUploading)throw Error('Espera a que termine la carga del PDF o cancélala.');if(identityLoading)throw Error('Espera mientras revisamos el DNI guardado.');if(receipt.blocked||receipt.missing||receiptFilePending)throw Error('Selecciona, completa o adjunta la boleta de venta antes de confirmar.');if(evidenceBusy||evidenceInvalid)throw Error('ESPERA LAS CARGAS O QUITA LAS FOTOS QUE NO SE PUDIERON PREPARAR.');return await api.post<{requests:RegistrationRequest[]}>('/registration-operations',makeInput(true));}catch(e){if(e instanceof ApiError&&e.code==='REGISTRATION_RECEIPT_CHANGED')receipt.retry();return fail(e);}});if(result){setSaved(result);evidence.clear();}}
 const attachmentCount=Object.values(evidence.drafts).filter(d=>d.prepared&&d.category!==movistarDeclarationCategory&&selected.includes(d.value)&&(!savedIdentityCategories.includes(d.category)||selectedIdentityChanges.some(choice=>choice.category===d.category))).length+identityDocuments.length;
 const relatedEquipmentPanel=<section className="linked-documents"><h3>Equipos vinculados a este documento</h3><p>Ventas y registros anteriores. Elige el IMEI que quieres registrar.</p><div className="related-equipment-grid"><button type="button" className={`related-equipment-card ${!chosenEquipment?'selected':''}`} aria-pressed={!chosenEquipment} onClick={newEquipment}><Smartphone size={18} aria-hidden="true"/> Registrar equipo nuevo</button>{linked.loading?<p role="status">Cargando equipos...</p>:linked.data?.length?linked.data.map(value=><button type="button" key={value.id} className={`related-equipment-card ${chosenEquipment?.id===value.id?'selected':''}`} aria-pressed={chosenEquipment?.id===value.id} onClick={()=>selectEquipment(value)}><strong>{value.code} · {value.brand} {value.commercialName||value.model}</strong><p>{value.model}</p><p>{value.imeis.map(i=>`IMEI ${i.slot}: ${i.value}`).join(' / ')}</p><span>Elegir equipo existente</span></button>):<p className="form-hint">No hay equipos vinculados a este documento. Puedes ingresar los datos de otro equipo.</p>}</div><ErrorNotice message={linked.error?.message}/></section>;
 let priceStepValid=false;
 let priceStepIssue='';
 if(step===2&&operatorsConfirmed){
  if(!Number.isFinite(Date.parse(date)))priceStepIssue='Selecciona la fecha y hora de atención.';
  else try{makeInput();priceStepValid=true;}catch(error){
   if(!(error instanceof z.ZodError))throw error;
   priceStepIssue=error.issues[0]?.message??'Revisa los datos de precio y condiciones.';
  }
 }
 if(saved)return <RegistrationSuccess requests={saved.requests} onNew={()=>{window.location.assign('/registros/nuevo');}}/>;
 return <div className="registration-workspace reference-panel"><WizardHeader onClose={()=>navigate('/registros')}/><RegistrationStepper busy={submit.busy} step={step} error={!!submit.error||!!Object.keys(errors).length} onBack={go}/><div className="registration-layout"><FormValidation errors={errors}><form ref={form} noValidate onSubmit={async e=>{e.preventDefault();if(step===3)await save();else await next();}}><fieldset disabled={submit.busy}>
 {step===0&&<section className="form-panel"><h2 data-step-heading tabIndex={-1}>Datos del cliente</h2><p className="step-description">Identifica al cliente y selecciona el equipo que deseas registrar.</p><div className="dni-client-fields"><div className="form-grid"><label>Documento *<div className="document-number"><select aria-label="Tipo de documento" disabled value="DNI"><option>DNI</option></select><ValidatedInput aria-label="DNI" name="dni" inputMode="numeric" autoComplete="off" maxLength={8} required value={draft.dni} placeholder="8 dígitos" onChange={e=>resetDni(e.target.value)}/></div></label><label>Nombre Completo *<ValidatedInput aria-label="Nombre completo" name="fullName" required maxLength={201} readOnly={!!lookup.localClient&&!can('clients.update')} value={name} onChange={e=>setDraft({...draft,firstName:'',lastName:'',fullName:normalizeTypedText(e.target.value)})}/></label></div>
 {lookup.loading&&<div className="dni-notice" role="status"><p>Consultando DNI...</p><button type="button" className="text-button" onClick={lookup.useManual}>Ingresar datos manualmente</button></div>}
 {lookup.localClient&&<p className="form-hint" role="status"><CheckCircle2 size={16} aria-hidden="true"/> <span>Cliente encontrado</span> · {lookup.localClient.code}</p>}
 {lookup.localClient&&name!==clientName(lookup.localClient)&&<p className="dni-notice">AL GUARDAR SE CORREGIRÁ EL NOMBRE DEL CLIENTE. SE CONSERVAN SUS EQUIPOS E HISTORIAL.</p>}
 {lookup.data?.source==='EXTERNAL'&&<p className="dni-notice" role="status">Datos encontrados. Revisa el nombre antes de guardar.{lookup.data.data.simulated?' CONSULTA SIMULADA DE PRUEBAS.':''}</p>}
 {(lookup.data?.source==='NONE'||lookup.error)&&<div className="dni-notice" role="status"><p>{lookup.data?.source==='NONE'?lookup.data.error.message:lookup.error?.message}</p><button type="button" className="text-button" onClick={lookup.retry}>Reintentar consulta DNI</button><p>Puedes completar la información manualmente.</p></div>}</div>
 <div className="form-grid">{(['phone','referencePhone','address'] as const).map((key,index)=><label className={key==='address'?'address-field':undefined} key={key}>{['Celular de este registro *','N.º Referencia','Dirección *'][index]}<ValidatedInput aria-label={['Celular de este registro','Número de referencia','Dirección de atención'][index]} name={key} type="text" inputMode={key==='phone'||key==='referencePhone'?'numeric':undefined} required={key!=='referencePhone'} maxLength={key==='phone'||key==='referencePhone'?9:300} value={contact[key]} onChange={e=>setContact(previous=>({...previous,[key]:key==='address'?normalizeTypedText(e.target.value):e.target.value}))}/>{key==='referencePhone'&&<span className="form-hint">Si lo dejas vacío, usaremos el contacto: {reference||'pendiente'}.</span>}</label>)}<label className="department-field">Departamento *<select aria-label="Departamento" name="department" aria-invalid={!!errors.department} aria-describedby={errors.department?'error-department':undefined} value={normalizeTypedText(contact.department)} onChange={e=>setContact(previous=>({...previous,department:e.target.value}))}><option value="">SELECCIONAR DEPARTAMENTO</option>{contact.department&&!departments.includes(normalizeTypedText(contact.department))&&<option value={normalizeTypedText(contact.department)}>{contact.department}</option>}{departments.map(d=><option key={d}>{d}</option>)}</select>{fieldError('department')}</label><p className="combined-address"><strong>Dirección final:</strong> {contact.address||'—'}{contact.department?` - ${contact.department}`:''}</p><label className="full-width">Correo Electrónico *<ValidatedInput aria-label="Correo de atención" name="email" type="email" required value={contact.email} onChange={e=>setContact(previous=>({...previous,email:normalizeEmail(e.target.value)}))}/></label></div>
 {lookup.localClient&&<button type="button" className="text-button" onClick={()=>setContact(previous=>({...previous,phone:previous.phone||lookup.localClient?.phone||'',email:previous.email||lookup.localClient?.email||'',address:previous.address||lookup.localClient?.address||'',department:previous.department||lookup.localClient?.department||'',province:previous.province||lookup.localClient?.province||''}))}>Usar contacto guardado</button>}
 {lookup.valid&&<details className="client-document-disclosure"><summary>DOCUMENTACIÓN PRIVADA DEL CLIENTE</summary><InlineIdentityDocuments value={{...draft,phone:contact.phone,email:contact.email,address:contact.address,department:contact.department,province:contact.province}} lookup={lookup}/></details>}{lookup.valid&&relatedEquipmentPanel}</section>}
 {step===1&&<section className="form-panel"><h2 data-step-heading tabIndex={-1}>Datos del equipo</h2><p className="step-description">Identifica el dispositivo y selecciona los IMEIs que deseas registrar.</p>{!found&&<section className="scanner-card"><BoxScanner equipment={equipment} imeis={imeis} onDetected={(value,next)=>{setEquipment(value);setImeis(next);setSelected([]);setBoth(false);setResolution(null);setConfirmed(false);}}/></section>}{relatedEquipmentPanel}
 {found?<div className="lookup-result"><strong>Equipo encontrado: {found.code}</strong><p>{found.brand} {found.model} · {found.commercialName}</p><p>DATOS RECUPERADOS DEL EQUIPO EXISTENTE.</p><button type="button" className="secondary-button" onClick={()=>selectEquipment(found)}>Recuperar ambos IMEIs del equipo</button><label className="checkbox-label"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Confirmo que un IMEI adicional pertenece a este equipo</label></div>:null}
 <div className="imei-selection">{imeis[0]?.value&&imeis[0].value===imeis[1]?.value&&<p className="field-error" role="alert">Los IMEIs deben ser diferentes.</p>}<div className="form-grid">{[1,2].map(slot=><label key={slot}>IMEI {slot}<ValidatedInput validateImei aria-label={`IMEI ${slot}`} name={`imeis.${slot-1}.value`} required={slot===1} inputMode="numeric" maxLength={15} value={imeis.find(i=>i.slot===slot)?.value??''} onChange={e=>changeImeis([1,2].map(s=>({slot:s,value:s===slot?e.target.value:imeis.find(i=>i.slot===s)?.value??'',type:imeis.find(i=>i.slot===s)?.type??'PHYSICAL'})))}/></label>)}</div>{identity.loading&&<p role="status">Buscando equipo...</p>}<ErrorNotice message={identity.error??undefined}/><Segmented label="¿REGISTRAR DOS IMEIs?" value={both?'both':'one'} options={[{value:'one',label:'No'},{value:'both',label:'Sí',disabled:!validBoth}]} onChange={v=>{setBoth(v==='both');setSelected(v==='both'?candidates.map(i=>i.value):selected.slice(0,1));}}/><h3>IMEI que se va a registrar *</h3><div className="imei-choice-grid">{candidates.map(i=><label className="checkbox-label selection-row" key={i.value}><input type={both?'checkbox':'radio'} name="targetImei" disabled={both||blocked(i.value)} checked={selected.includes(i.value)} onChange={()=>setSelected([i.value])}/><span className="imei-choice-copy"><strong>IMEI {i.slot}: </strong><span>{i.value}</span></span>{'registrationStatus' in i&&typeof i.registrationStatus==='string'&&<StatusBadge status={String(i.registrationStatus)}/>} {blocked(i.value)&&<span>{isValidImeiLuhn(i.value)?'No disponible para nueva solicitud':'IMEI inválido: requiere corrección antes de un trámite nuevo.'}</span>}</label>)}</div>{both&&secondImei&&<label>Celular del IMEI 2 *<ValidatedInput name="secondPhone" aria-label="Celular del IMEI 2" inputMode="numeric" autoComplete="off" maxLength={9} placeholder="9 dígitos" required value={secondPhone} onChange={event=>{const phone=event.target.value;setDetails(previous=>({...previous,[secondImei.value]:{...(previous[secondImei.value]??{operator:'BITEL',mode:'REGISTRATION',price:'0'}),phone}}));setErrors(previous=>{const next={...previous};delete next.secondPhone;return next;});}}/><span className="form-hint">Un número distinto del celular del IMEI 1. Se usará en la segunda solicitud.</span></label>}</div><FieldScope prefix="equipment"><EquipmentFields registration readOnly={!!found} commercialRequired={!found} value={equipment} onChange={setEquipment}/></FieldScope></section>}
 {step===2&&<section className="form-panel"><h2 data-step-heading tabIndex={-1}>PRECIO Y CONDICIONES DEL REGISTRO</h2><p className="step-description">¿Es correcto el operador para este registro?</p>{selected.map((value,index)=>{const detail=details[value],slot=imeis.find(i=>i.value===value)?.slot??index+1;return detail&&<section className="request-fields" key={value}>{selected.length===2&&<h3>Solicitud IMEI {slot}: {value}</h3>}<div className="form-grid"><div className="registration-operator">
  <label>Operador<select aria-label={`Operador IMEI ${slot}`} value={detail.operator} onChange={event=>{
   const operator=event.target.value as typeof detail.operator;
   setDetails(previous=>({...previous,[value]:{...detail,operator}}));
   setConfirmedOperators(previous=>({...previous,[value]:''}));
  }}>{operators.map(operator=><option key={operator} value={operator}>{operator.charAt(0)+operator.slice(1).toLowerCase()}</option>)}</select></label>
  <button type="button" className="secondary-button" aria-label={`Confirmar operador IMEI ${slot}`}
   aria-pressed={confirmedOperators[value]===detail.operator} onClick={()=>setConfirmedOperators(previous=>({...previous,[value]:detail.operator}))}>
   {confirmedOperators[value]===detail.operator?<><CheckCircle2 size={16} aria-hidden="true"/> Operador confirmado</>:'Confirmar operador'}
  </button>
 </div><label>Estado del equipo<select aria-label={`Estado del equipo IMEI ${slot}`} value={detail.mode} onChange={e=>setDetails({...details,[value]:{...detail,mode:e.target.value as typeof detail.mode}})}><option value="REGISTRATION">NO BLOQUEADO</option><option value="BLOCKED">BLOQUEADO</option></select></label><label>Estado de solicitud<select aria-label={`Estado de solicitud IMEI ${slot}`} disabled value={detail.mode==='BLOCKED'?'BLOCKED':'PENDING'}><option value="PENDING">PENDIENTE</option><option value="BLOCKED">BLOQUEADO</option></select><span className="form-hint">{detail.mode==='BLOCKED'?'El desbloqueo se confirma desde el detalle.':'Márcalo como registrado al confirmar el trámite externo.'}</span></label><label>Tipo<select aria-label="Tipo de equipo" disabled={!!resolution?.equipment} value={resolution?.equipment?.origin??found?.origin??origin} onChange={e=>setOrigin(e.target.value as typeof origin)}><option value="STORE">TIENDA</option><option value="EXTERNAL">EXTERNO</option></select></label><label>Precio (S/) *<ValidatedInput aria-label={`Precio IMEI ${slot} (S/)`} name={`requests.${index}.price`} required inputMode="decimal" value={detail.price} onChange={e=>setDetails({...details,[value]:{...detail,price:e.target.value}})}/>{selected.length===2&&<span className="form-hint">Importe de esta solicitud; no se divide automáticamente.</span>}</label><label>Celular vinculado al IMEI {slot}<ValidatedInput aria-label={`Celular IMEI ${slot}`} name={`requests.${index}.phone`} inputMode="numeric" maxLength={9} required value={detail.phone} onChange={e=>setDetails({...details,[value]:{...detail,phone:e.target.value}})}/></label></div></section>;})}<Segmented label="¿Tiene caja? *" value={hasBox?'yes':'no'} options={[{value:'yes',label:'Sí'},{value:'no',label:'No'}]} onChange={v=>setHasBox(v==='yes')}/><p className="form-hint">Si seleccionas No, la foto de caja se deshabilitará. Las fotos ya cargadas se conservan hasta que decidas quitarlas.</p><label>Fecha y hora *<input type="datetime-local" aria-label="Fecha y hora de atención" required value={date} onChange={e=>{dateEdited.current=true;setDate(e.target.value);}}/></label></section>}
 {step===3&&<><section className="form-panel"><h2 data-step-heading tabIndex={-1}>EVIDENCIAS FOTOGRÁFICAS</h2><p className="step-description">Adjunta evidencias y revisa la información antes de guardar.</p></section>{imeis.filter(imei=>movistarImeis.includes(imei.value)).map(imei=><MovistarDeclarationDraft key={imei.value} imei={imei.value} slot={imei.slot} manager={evidence} allowed={can('registration.evidence.upload')}/>)}<section className="form-panel"><RegistrationDniExtraction key={draft.dni} clientId={localId} current={currentIdentity} choices={identityChoices}
    ready={!identityLoading&&!identityState.error} ensureClient={ensureIdentityClient} onChoose={chooseIdentity} onRemove={removeIdentity}/>
   <ClientDocumentPicker key={localId} clientId={localId??null} replacedSides={selectedIdentityChanges.map(choice=>choice.category)} onChange={setIdentityState}/><p className="form-hint">Al confirmar el registro, las fotos nuevas del DNI también se guardan en la ficha del cliente para sus próximos trámites.</p></section><EvidenceDrafts savedIdentityCategories={savedIdentityCategories}
    currentIdentity={currentIdentity} identityChoices={identityChoices} onIdentityChoose={chooseIdentity} onIdentityRemove={removeIdentity} receiptPanel={<RegistrationReceiptPanel state={receipt}/>} receiptSelected={!!receipt.choice} onReceiptPending={setReceiptFilePending} hasBox={hasBox} values={selected} slots={Object.fromEntries(imeis.map(i=>[i.value,i.slot]))} manager={evidence}/><section className="form-panel"><RegistrationReview name={name} dni={client.dni} phone={contact.phone} reference={reference} email={contact.email} address={contact.address} department={contact.department} equipment={equipment} origin={resolution?.equipment?.origin??found?.origin??origin} requests={selected.map(value=>({value,slot:imeis.find(i=>i.value===value)?.slot??1,...details[value]}))} attached={attachmentCount-identityDocuments.length+selectedIdentityChanges.filter(choice=>choice.documentId).length+(receipt.choice&&!hasReceiptUpload?1:0)} reused={identityDocuments.length} hasBox={hasBox} onEdit={go}/></section></>}
 {step===2&&priceStepIssue&&<p className="field-error" role="status">{priceStepIssue}</p>}<ErrorNotice message={submit.error}/><div className="form-actions registration-actions mobile-workflow-actions">{step>0&&<button type="button" className="secondary-button" onClick={()=>go(step-1)}>Atrás</button>}<button className="primary-button" disabled={submit.busy||step>=1&&!imeiListSchema.safeParse(imeis).success||step===0&&lookup.loading||step===1&&identity.loading||step===2&&!priceStepValid||step===3&&(declarationUploading||receipt.blocked||receiptFilePending||evidenceBusy||evidenceInvalid||identityLoading)}>{submit.busy?'Procesando...':step===3?'Confirmar y guardar':'Siguiente'}</button><button type="button" className="text-button" onClick={()=>navigate('/registros')}>Cancelar</button></div></fieldset></form></FormValidation></div></div>;
}
