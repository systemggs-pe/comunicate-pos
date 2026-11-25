import {imeiListSchema} from '../../../shared/validation';
import {X,Check} from 'lucide-react';
import './sales-reference.css';
import '../registrations/registration.css';
import {SaleClientFields} from './SaleClientFields';
import {clientReferenceSchema} from '../../../shared/sales';
import {focusFormHeading,useFormStepFocus} from '../../hooks/useFormStepFocus';
import {normalizeTypedText} from '../../../shared/normalization';
import { limaDateTimeNow,limaDateTimeIso } from '../../../shared/operational-date';
import { AccessoriesEditor } from './AccessoriesEditor';

import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';

import type { SaleAccessory } from '../../types/pos';

import { FormValidation, FieldScope, ValidatedInput } from '../../components/FormValidation';
import { useEffect, useRef, useState } from 'react';

import { useApi } from '../../app/ApiProvider';

import { navigate } from '../../app/router';

import { useSubmit } from '../../hooks/useSubmit';

import { saleFlowSchema, cents, decimalMoney } from '../../../shared/sales';



import { SaleEquipmentEditor, emptySaleItem } from './SaleEquipmentEditor';

import { money, paymentLabels, ClientName, SaleReviewItem } from './common';

import { ErrorNotice } from '../../components/common';

import type { ClientReference, PaymentMethod, Sale, SaleInput } from '../../types/pos';



export function NewSale() {

  const { api } = useApi(); const form=useRef<HTMLFormElement>(null); const submit = useSubmit(form); const [buyer, setBuyer] = useState<ClientReference | null>(null), [items, setItems] = useState([{ key: 1, value: emptySaleItem(), ownerRequired: false }]), [counter, setCounter] = useState(2);

  const [method, setMethod] = useState<PaymentMethod>('CASH'), [discount, setDiscount] = useState('0'), [notes, setNotes] = useState('');

  const [accessories,setAccessories]=useState<SaleAccessory[]>([]),[date,setDate]=useState(limaDateTimeNow),[saved,setSaved]=useState(false);

  useUnsavedChanges(!saved&&(!!buyer||items.some(row=>!!row.value.unitPrice||row.value.equipment?.imeis.some(i=>!!i.value)||!!row.value.equipment?.brand)||accessories.length>0||!!notes||discount!=='0'));

  const [step,setStep]=useState(0); const [operationKey]=useState(()=>crypto.randomUUID()); const dateEdited=useRef(false);
  useEffect(()=>{let active=true;void api.get<{serverTime:string}>('/server-time').then(r=>{if(active&&!dateEdited.current)setDate(new Date(new Date(r.serverTime).getTime()-18000000).toISOString().slice(0,16));}).catch(()=>undefined);return()=>{active=false;};},[api]);
  const [review, setReview] = useState<{ input: SaleInput; subtotal: string; total: string } | null>(null);

  useFormStepFocus(step,form);

  let preview: string | null = null; try { preview = decimalMoney(items.reduce((sum, item) => sum + cents(item.value.unitPrice), 0n) + accessories.reduce((sum,line)=>sum+cents(line.unitPrice)*BigInt(line.quantity),0n) - cents(discount)); } catch { /* Campos incompletos: mostrar instrucción, sin inventar total. */ }

  return <section className="registration-workspace reference-panel sales-workspace"><div className="wizard-header"><div><p className="eyebrow">VENTAS</p><h1>Registrar venta</h1><p>Registra cliente, equipo vendido y datos para el ticket.</p></div><button type="button" className="icon-button" aria-label="Cerrar nueva venta" onClick={()=>navigate('/ventas')}><X size={20}/></button></div><div className="registration-progress"><p role="status">Paso {step+1} de 2</p><ol aria-label="Etapas de la venta">{['Cliente','Equipo y Precio'].map((label,index)=><li key={label} className={index<step?'complete':index===step?'active':''}><button type="button" disabled={index>step} onClick={()=>{setStep(index);setReview(null);}} aria-current={index===step?'step':undefined}><span className="step-symbol">{index<step?<Check size={14}/>:index+1}</span><strong>{label}</strong></button></li>)}</ol></div><div className="registration-layout"><FormValidation errors={submit.fields}><form ref={form} onSubmit={async e => {

    e.preventDefault(); if(step===0){const result=await submit.run(async()=>clientReferenceSchema.parse(buyer));if(result){setStep(1);}return;}
    const result=await submit.run(async()=>{
      if(review)return api.post<Sale>('/sales',review.input);
      if(items.some(item=>item.ownerRequired&&!item.value.owner))throw new Error('Selecciona todos los propietarios distintos del comprador.');
      const input=saleFlowSchema.parse({buyer,buyerPhone:buyer&&'client'in buyer?buyer.client.phone??'':undefined,buyerEmail:buyer&&'client'in buyer?buyer.client.email??'':undefined,items:items.map(item=>({...item.value,equipment:{...item.value.equipment,serialNumber:item.value.equipment.serialNumber?.trim()||null}})),paymentMethod:method,discount,notes,accessories,occurredAt:limaDateTimeIso(date),idempotencyKey:operationKey});
      const totals=await api.post<{subtotal:string;total:string}>('/sales/resolve',input);
      setReview({input,...totals});return api.post<Sale>('/sales',input);
    });
    if(result){setSaved(true);window.dispatchEvent(new Event('pos:form-saved'));navigate(`/ventas/${result.id}?saved=1`);}
  }}><fieldset disabled={submit.busy}><div hidden={step!==0}><h2 data-step-heading tabIndex={-1}>Datos del cliente</h2><FieldScope prefix="buyer.client"><SaleClientFields onChange={setBuyer}/></FieldScope></div>{step===1&&!review ? <><div className="section-heading"><h2 data-step-heading tabIndex={-1}>Equipo y precio</h2><button type="button" className="secondary-button" onClick={() => { setItems(values => [...values, { key: counter, value: emptySaleItem(), ownerRequired: false }]); setCounter(value => value + 1); requestAnimationFrame(()=>{const rows=form.current?.querySelectorAll('.sale-item');focusFormHeading(rows?.item(rows.length-1)?.querySelector<HTMLElement>('h3')??null);}); }} disabled={items.length >= 20}>Agregar otro equipo</button></div>{items.map((item, index) => <SaleEquipmentEditor key={item.key} ownerRequired={item.ownerRequired} item={item.value} index={index} onChange={value => setItems(values => values.map(row => row.key === item.key ? { ...row, value } : row))} onOwnerRequiredChange={required => setItems(values => values.map(row => row.key === item.key ? { ...row, ownerRequired: required } : row))} onRemove={() => setItems(values => values.filter(row => row.key !== item.key))} />)}{!items.length && <p className="muted">Agrega al menos un equipo para continuar.</p>}<div className="form-panel"><div className="form-grid"><label>Fecha y hora de venta<input type="datetime-local" required value={date} onChange={e=>{dateEdited.current=true;setDate(e.target.value);}} /></label><label>Método de pago<select value={method} onChange={e => setMethod(e.target.value as PaymentMethod)}>{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Descuento de la venta (S/)<ValidatedInput name="discount" aria-label="Descuento de la venta (S/)" inputMode="decimal" value={discount} onChange={e => setDiscount(e.target.value)} /></label><label>Notas opcionales<textarea maxLength={1000} value={notes} onChange={e => setNotes(normalizeTypedText(e.target.value))} /></label></div><AccessoriesEditor value={accessories} onChange={setAccessories}/><p className="sale-total">TOTAL VENTA: <strong>{preview === null ? 'Completa los precios' : money(preview)}</strong></p><p className="form-hint">Los IMEIs permanecerán sin registrar. Antes de confirmar se comprobarán todos los valores.</p></div></> : step===1&&review ? <section className="form-panel sale-review" aria-label="Resumen final"><h2 data-step-heading tabIndex={-1}>Resumen de venta</h2><p>Comprador: <ClientName reference={review.input.buyer} /></p>{review.input.items.map((item, index) => <SaleReviewItem key={index} item={item} index={index} />)}<h3>Accesorios</h3>{review.input.accessories?.map((line,index)=><p key={index}>{line.name} × {line.quantity} · {money(line.unitPrice)} · Importe {money(decimalMoney(cents(line.unitPrice)*BigInt(line.quantity)))}</p>)}<p>Fecha de venta: {new Date(review.input.occurredAt!).toLocaleString('es-PE',{timeZone:'America/Lima'})}</p><dl className="totals"><div><dt>Equipos</dt><dd>{review.input.items.length}</dd></div><div><dt>Método</dt><dd>{paymentLabels[review.input.paymentMethod]}</dd></div><div><dt>Subtotal</dt><dd>{money(review.subtotal)}</dd></div><div><dt>Descuento</dt><dd>{money(review.input.discount)}</dd></div><div><dt>Total</dt><dd><strong>{money(review.total)}</strong></dd></div></dl><p className="form-hint">Confirma la compra. El propietario y registro de IMEIs son datos independientes.</p></section>:null}<ErrorNotice message={submit.error} /><div className="form-actions mobile-workflow-actions"><button type="button" className="secondary-button" onClick={()=>{if(step===0)navigate('/ventas');else if(review)setReview(null);else setStep(0);}}>{step===0?'Cancelar':'Atrás'}</button><button className="primary-button" disabled={submit.busy||step===1&&items.some(item=>!imeiListSchema.safeParse(item.value.equipment.imeis).success)}>{submit.busy ? 'Procesando venta...' : step===0?'Siguiente':'Confirmar y guardar'}</button></div></fieldset></form></FormValidation></div></section>;
}
