import {useRef,useState} from 'react';
import {ArrowLeft} from 'lucide-react';
import {useAuth} from '../../app/AuthProvider';
import {Link} from '../../app/router';
import {useSubmit} from '../../hooks/useSubmit';
import {useUnsavedChanges} from '../../hooks/useUnsavedChanges';
import {FormValidation,FieldScope,ValidatedInput} from '../../components/FormValidation';
import {ErrorNotice} from '../../components/common';
import {ClientPicker} from '../clients/ClientPicker';
import {displayClientName} from '../clients/displayName';
import {EquipmentFields} from '../equipment/EquipmentForm';
import {AccessoriesEditor} from './AccessoriesEditor';
import {saleEditSchema,cents,decimalMoney} from '../../../shared/sales';
import {limaDateTimeIso} from '../../../shared/operational-date';
import {normalizeTypedText} from '../../../shared/normalization';
import {money,paymentLabels} from './common';
import type {Sale,EquipmentInput,ClientReference,PaymentMethod,SaleAccessory} from '../../types/pos';
import './sale-edit.css';

const fields=(value:EquipmentInput):EquipmentInput=>({brand:value.brand,model:value.model,commercialName:value.commercialName??null,serialNumber:value.serialNumber??null,color:value.color??null,ram:value.ram??null,storage:value.storage??null});
export function SaleEdit({sale,onSaved,onCancel}:{sale:Sale;onSaved:()=>void;onCancel:()=>void}){
 const {api,can}=useAuth(),form=useRef<HTMLFormElement>(null),submit=useSubmit(form);
 const initialDate=new Date(new Date(sale.occurredAt??sale.createdAt).getTime()-18000000).toISOString().slice(0,16);
 const [buyer,setBuyer]=useState<ClientReference|null>({id:sale.buyerId}),[date,setDate]=useState(initialDate),[payment,setPayment]=useState<PaymentMethod>(sale.paymentMethod),[discount,setDiscount]=useState(sale.discount),[notes,setNotes]=useState(sale.notes??''),[phone,setPhone]=useState(sale.buyerPhone??''),[email,setEmail]=useState(sale.buyerEmail??'');
 const [lines,setLines]=useState(()=>(sale.equipment??[]).map(line=>({id:line.id,unitPrice:line.unitPrice,equipment:fields(line.equipment)})));
 const [accessories,setAccessories]=useState<SaleAccessory[]>(()=>sale.accessories?.map(line=>({name:line.name,quantity:line.quantity,unitPrice:line.unitPrice}))??[]);
 const baselineLines=(sale.equipment??[]).map(line=>({id:line.id,unitPrice:line.unitPrice,equipment:fields(line.equipment)}));
 const baselineAccessories=sale.accessories?.map(line=>({name:line.name,quantity:line.quantity,unitPrice:line.unitPrice}))??[];
 const dirty=JSON.stringify(buyer)!==JSON.stringify({id:sale.buyerId})||date!==initialDate||payment!==sale.paymentMethod||discount!==sale.discount||notes!==(sale.notes??'')||phone!==(sale.buyerPhone??'')||email!==(sale.buyerEmail??'')||JSON.stringify(lines)!==JSON.stringify(baselineLines)||JSON.stringify(accessories)!==JSON.stringify(baselineAccessories);
 useUnsavedChanges(dirty);
 function cancel(){if(dirty&&!window.confirm('¿Salir sin guardar los cambios de esta venta?'))return;window.dispatchEvent(new Event('pos:form-saved'));onCancel();}
 let total:string|null=null;
 try{
  const signature=(rows:SaleAccessory[])=>JSON.stringify(rows.map(row=>[row.name,row.quantity,cents(row.unitPrice).toString()]));
  const changed=cents(discount)!==cents(sale.discount)||lines.some(line=>cents(line.unitPrice)!==cents(sale.equipment!.find(old=>old.id===line.id)!.unitPrice))||signature(accessories)!==signature(sale.accessories??[]);
  const amount=lines.reduce((sum,line)=>sum+cents(line.unitPrice),0n)+accessories.reduce((sum,line)=>sum+cents(line.unitPrice)*BigInt(line.quantity),0n)-cents(discount);
  total=changed?amount<0n?null:decimalMoney(amount):sale.total;
 }catch{/* Keep unfinished values available for correction. */}
 async function save(){const result=await submit.run(()=>{
  if(!buyer)throw new Error('Selecciona el comprador.');
  const input=saleEditSchema.parse({expectedUpdatedAt:sale.updatedAt,buyer,buyerPhone:phone===(sale.buyerPhone??'')?undefined:phone||null,buyerEmail:email===(sale.buyerEmail??'')?undefined:email||null,occurredAt:date===initialDate?undefined:limaDateTimeIso(date),paymentMethod:payment,discount,notes:notes===(sale.notes??'')?undefined:notes,accessories,
   items:lines.map(line=>{const original=sale.equipment!.find(item=>item.id===line.id)!;const changed=JSON.stringify(line.equipment)!==JSON.stringify(fields(original.equipment));return {id:line.id,unitPrice:line.unitPrice,...(changed?{equipment:{...line.equipment,serialNumber:line.equipment.serialNumber?.trim()||null},expectedEquipmentUpdatedAt:original.equipment.updatedAt}:{})};})});
  return api.patch(`/sales/${sale.id}`,input);
 });if(result){window.dispatchEvent(new Event('pos:form-saved'));onSaved();}}
 return <section className="sale-edit-page"><header className="sale-edit-heading"><button type="button" className="text-button" onClick={cancel}><ArrowLeft size={16} aria-hidden="true"/>Volver</button><h1>Editar venta {sale.code}</h1><p>Corrige los datos y guarda los cambios.</p></header><FormValidation errors={submit.fields}><form ref={form} onSubmit={event=>{event.preventDefault();void save();}}><fieldset disabled={submit.busy}>
 <section className="form-panel sale-edit-section"><h2>Comprador y pago</h2>{can('clients.read')?<ClientPicker label="Comprador" value={buyer} onChange={next=>{const key=(value:ClientReference|null)=>value?'id' in value?value.id:value.client.dni:'';if(key(next)!==key(buyer)){setPhone('');setEmail('');}setBuyer(next);}}/>:<p>{displayClientName(sale.buyer)} · DNI {sale.buyer.dni}</p>}<p className="form-hint">El comprador y el propietario del equipo se guardan por separado.</p><div className="form-grid"><label>Celular de esta venta<ValidatedInput name="buyerPhone" inputMode="tel" maxLength={30} value={phone} onChange={event=>setPhone(event.target.value)}/></label><label>Correo de esta venta<ValidatedInput name="buyerEmail" type="email" maxLength={254} value={email} onChange={event=>setEmail(event.target.value)}/></label><label>Fecha y hora de venta<ValidatedInput name="occurredAt" type="datetime-local" required value={date} onChange={event=>setDate(event.target.value)}/></label><label>Método de pago<select value={payment} onChange={event=>setPayment(event.target.value as PaymentMethod)}>{Object.entries(paymentLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div></section>
 <section className="form-panel sale-edit-section"><h2>Equipos vendidos</h2>{lines.map((line,index)=>{const original=sale.equipment!.find(item=>item.id===line.id)!;return <article className="sale-edit-line" key={line.id}><div className="sale-edit-line-heading"><div><h3>{original.equipment.commercialName||`${original.equipment.brand} ${original.equipment.model}`}</h3><p>{original.equipment.code}</p></div><label>Precio del equipo (S/)<ValidatedInput name={`items.${index}.unitPrice`} aria-label={`Precio del equipo ${index+1}`} inputMode="decimal" required value={line.unitPrice} onChange={event=>setLines(previous=>previous.map(item=>item.id===line.id?{...item,unitPrice:event.target.value}:item))}/></label></div><p className="sale-edit-imeis">{original.equipment.imeis.map(imei=><span key={imei.id}>IMEI {imei.slot}: {imei.value}</span>)}</p><details><summary>Datos del equipo</summary>{can('equipment.update')?<FieldScope prefix={`items.${index}.equipment`}><EquipmentFields value={line.equipment} onChange={equipment=>setLines(previous=>previous.map(item=>item.id===line.id?{...item,equipment}:item))}/></FieldScope>:<p>Necesitas permiso de edición de equipos para cambiar estos datos.</p>}{can('equipment.update')&&<Link className="inline-link" to={`/equipos/${original.equipment.id}?edit=1`}>Corregir IMEI o consultar la ficha del equipo</Link>}</details></article>;})}</section>
 <AccessoriesEditor value={accessories} onChange={setAccessories}/><section className="form-panel sale-edit-section"><div className="form-grid"><label>Descuento (S/)<ValidatedInput name="discount" required inputMode="decimal" value={discount} onChange={event=>setDiscount(event.target.value)}/></label><label>Notas<textarea maxLength={1000} value={notes} onChange={event=>setNotes(normalizeTypedText(event.target.value))}/></label></div><p className="sale-edit-total">Total de la venta<strong>{total===null?'Revisa los importes':money(total)}</strong></p></section><ErrorNotice message={submit.error}/><div className="form-actions"><button className="primary-button" disabled={submit.busy||!dirty||!buyer||total===null}>{submit.busy?'Guardando…':'Guardar cambios'}</button><button type="button" className="secondary-button" disabled={submit.busy} onClick={cancel}>Cancelar</button></div>
 </fieldset></form></FormValidation></section>;
}
