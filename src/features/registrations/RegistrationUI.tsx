import {Check,AlertCircle,ShieldCheck,ShieldAlert,X} from 'lucide-react';
export const registrationSteps=['Datos del cliente','Datos del equipo','Precio','Evidencias'];
export function WizardHeader({onClose,code,busy=false}:{onClose:()=>void;code?:string;busy?:boolean}){
 return <div className="wizard-header">
  <div><p className="eyebrow">REGISTROS</p><h1>{code?`Editar registro ${code}`:'Nuevo registro'}</h1><p>{code?'Revisa los datos del trámite y corrige lo que necesites.':'Completa los datos del cliente, equipo, precio y evidencias.'}</p></div>
  <button type="button" className="icon-button" disabled={busy} aria-label={code?'Cerrar edición de registro':'Cerrar nuevo registro'} onClick={onClose}><X size={20}/></button>
 </div>;
}
export function RegistrationStepper({step,error,onBack,busy=false}:{step:number;error:boolean;busy?:boolean;onBack:(step:number)=>void}){
 return <div className="form-progress registration-progress"><p role="status">Paso {step+1} de 4 — {registrationSteps[step]}</p><ol aria-label="Etapas del registro">{registrationSteps.map((label,index)=>{const done=index<step;return <li className={done?'complete':index===step?'active':''} key={label}><button type="button" aria-label={`${index+1} ${label}${done?' completado':index===step?(error?' con errores':' actual'):' pendiente'}`} aria-current={step===index?'step':undefined} disabled={busy||index>step} onClick={()=>onBack(index)}><span className="step-symbol">{done?<Check size={14} aria-hidden="true"/>:error&&index===step?<AlertCircle size={14} aria-hidden="true"/>:index+1}</span><strong>{label}</strong></button></li>;})}</ol></div>;
}
export function Segmented<T extends string>({label,value,options,onChange,disabled=false}:{label:string;value:T;options:{value:T;label:string;disabled?:boolean;tone?:'warning'|'positive'}[];onChange:(v:T)=>void;disabled?:boolean}){
 return <fieldset className="segmented" disabled={disabled}><legend>{label}</legend><div>{options.map(option=><label key={option.value} className={`${option.value===value?'selected':''} ${option.tone??''}`} ><input type="radio" name={label} value={option.value} checked={option.value===value} disabled={option.disabled} onChange={()=>onChange(option.value)}/>{option.tone==='warning'?<ShieldAlert size={18} aria-hidden="true"/>:option.tone==='positive'?<ShieldCheck size={18} aria-hidden="true"/>:null}{option.label}</label>)}</div></fieldset>;
}
export const departments=['AMAZONAS','ÁNCASH','APURÍMAC','AREQUIPA','AYACUCHO','CAJAMARCA','CALLAO','CUSCO','HUANCAVELICA','HUÁNUCO','ICA','JUNÍN','LA LIBERTAD','LAMBAYEQUE','LIMA','LORETO','MADRE DE DIOS','MOQUEGUA','PASCO','PIURA','PUNO','SAN MARTÍN','TACNA','TUMBES','UCAYALI'];
