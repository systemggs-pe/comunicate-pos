import {useState} from 'react';
import {useApi} from '../../app/ApiProvider';
import {useSubmit} from '../../hooks/useSubmit';
import {FormValidation,ValidatedInput} from '../../components/FormValidation';
import {ErrorNotice} from '../../components/common';
import {imeiCorrectionSchema} from '../../../shared/validation';
import {isValidImeiLuhn} from '../../../shared/imei';
import type {Equipment,Imei} from '../../types/pos';

export function ImeiCorrection({imei,equipmentId,onSaved}:{imei:Imei;equipmentId:string;onSaved:()=>void}){
 const {api}=useApi(),submit=useSubmit(),[open,setOpen]=useState(false),[value,setValue]=useState(imei.value),[reason,setReason]=useState('');
 if(!open)return <button type="button" className="text-button" onClick={()=>setOpen(true)}>Corregir IMEI {imei.slot}</button>;
 return <FormValidation errors={submit.fields}><form className="form-panel" onSubmit={async event=>{
  event.preventDefault();const result=await submit.run(()=>api.patch<Equipment>(`/equipment/${equipmentId}/imeis/${imei.id}`,imeiCorrectionSchema.parse({expectedValue:imei.value,value,reason,confirm:true})));
  if(result){setOpen(false);onSaved();}
 }}><h3>Corregir IMEI {imei.slot}</h3><p className="form-hint">Copia el IMEI real del equipo. Las ventas y los registros conservarán sus vínculos; los archivos guardados no se modifican.</p><label>IMEI correcto<ValidatedInput validateImei name="value" aria-label={`IMEI ${imei.slot} correcto`} inputMode="numeric" autoComplete="off" required maxLength={15} value={value} onChange={event=>setValue(event.target.value)}/></label><label>Motivo de la corrección<input name="reason" required minLength={5} maxLength={300} value={reason} onChange={event=>setReason(event.target.value)}/></label><ErrorNotice message={submit.error}/><div className="form-actions"><button className="primary-button" disabled={submit.busy||!isValidImeiLuhn(value)||reason.trim().length<5}>{submit.busy?'Guardando…':'Confirmar corrección'}</button><button type="button" className="text-button" disabled={submit.busy} onClick={()=>setOpen(false)}>Cancelar</button></div></form></FormValidation>;
}
