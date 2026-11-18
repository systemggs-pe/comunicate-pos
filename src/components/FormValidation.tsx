import { normalizeTypedText,normalizeEmail } from '../../shared/normalization';
import { createContext, useContext, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import {CircleAlert,CheckCircle2} from 'lucide-react';
import {imeiValidationError,imeiMessages,isValidImeiLuhn} from '../../shared/imei';
import './imei-validation.css';

const Fields = createContext<{ errors: Record<string, string>; prefix: string }>({ errors: {}, prefix: '' });
export function FormValidation({ errors, children }: { errors: Record<string, string>; children: ReactNode }) {
  return <Fields.Provider value={{ errors, prefix: '' }}>{children}</Fields.Provider>;
}
export function FieldScope({ prefix, children }: { prefix: string; children: ReactNode }) {
  const parent = useContext(Fields);
  return <Fields.Provider value={{ ...parent, prefix: [parent.prefix, prefix].filter(Boolean).join('.') }}>{children}</Fields.Provider>;
}
export function ValidatedInput({ name, onChange, onInvalid, validateImei=false,...props }: InputHTMLAttributes<HTMLInputElement>&{validateImei?:boolean}) {
  const { errors, prefix } = useContext(Fields), id = useId();
  const [nativeError, setNativeError] = useState<{value:typeof props.value;message:string}|null>(null);
  const path = name ? [prefix, name].filter(Boolean).join('.') : undefined;
  const raw=typeof props.value==='string'?props.value:'';
  const liveError=validateImei&&raw&&(raw.length>=15||!/^[0-9]+$/.test(raw))?imeiValidationError(raw)?.message:undefined;
  const message = liveError||(path ? errors[path] : undefined) || (nativeError?.value===props.value?nativeError?.message:'');
  const valid=validateImei&&!message&&isValidImeiLuhn(raw);
  return <><input {...props} pattern={validateImei?'[0-9]{15}':props.pattern} name={path} aria-invalid={!!message} aria-describedby={[message||validateImei?id:'',props['aria-describedby']].filter(Boolean).join(' ')||undefined} onInvalid={event => { setNativeError({value:props.value,message:event.currentTarget.validationMessage}); onInvalid?.(event); }} onChange={event => { setNativeError(null);const field=event.currentTarget;if(name&&['firstName','lastName','address','department','brand','model','commercialName','color','ram','storage'].includes(name)){const position=field.selectionStart;field.value=normalizeTypedText(field.value);if(position!==null)field.setSelectionRange(Math.min(position,field.value.length),Math.min(position,field.value.length));}else if(name==='email')field.value=normalizeEmail(field.value);onChange?.(event); }} />{message?<span id={id} className="field-error imei-validation-feedback" role="alert">{validateImei&&<CircleAlert size={14} aria-hidden="true"/>}{message}</span>:validateImei&&<span id={id} className={`imei-validation-feedback ${valid?'imei-check-valid':'form-hint'}`} role="status">{valid&&<CheckCircle2 size={14} aria-hidden="true"/>}{valid?imeiMessages.valid:'15 dígitos, sin espacios ni símbolos.'}</span>}</>;
}
