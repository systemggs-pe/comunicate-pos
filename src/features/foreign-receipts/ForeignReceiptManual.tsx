import {useState} from 'react';
import type {ReactNode} from 'react';
import type {ForeignReceiptCustomer,ForeignReceiptDevice} from '../../../shared/foreign-receipts';
import {receiptDateInLima} from '../../../shared/foreign-receipts';
import {ErrorNotice} from '../../components/common';
import {ValidatedInput} from '../../components/FormValidation';
import {useApi} from '../../app/ApiProvider';
import {useAuth} from '../../app/AuthProvider';
import {useSubmit} from '../../hooks/useSubmit';
import {BoxScanner} from '../equipment/BoxScanner';

export type ManualReceipt={customer:ForeignReceiptCustomer;devices:ForeignReceiptDevice[];issuedAt:string};
const blankDevice=():ForeignReceiptDevice=>({imei1:'',imei2:'',commercialName:'',price:'',brand:'',model:'',storage:'',color:'',serialNumber:''});
export const blankManual=():ManualReceipt=>({customer:{type:'DNI',document:'',fullName:''},devices:[blankDevice()],issuedAt:receiptDateInLima(new Date())});
const equipmentFields={commercialName:'Nombre comercial',brand:'Marca',model:'Modelo',serialNumber:'Número de serie',storage:'Memoria',color:'Color'} as const;

export function ForeignReceiptManual({initial,onSave,busy,footer}:{initial?:ManualReceipt;onSave:(value:ManualReceipt)=>void;busy:boolean;footer:ReactNode}){
 const {api}=useApi(),{can}=useAuth(),lookup=useSubmit();
 const [data,setData]=useState(initial??blankManual),[notice,setNotice]=useState('');
 const [scanner,setScanner]=useState<number|null>(null);
 const {customer,devices}=data;
 function setCustomer<K extends keyof ForeignReceiptCustomer>(field:K,value:ForeignReceiptCustomer[K]){
  setData(previous=>({...previous,customer:{...previous.customer,[field]:value}}));
 }
 function setDevice(index:number,patch:Partial<ForeignReceiptDevice>){
  setData(previous=>({...previous,devices:previous.devices.map((device,i)=>i===index?{...device,...patch}:device)}));
 }
 async function findCustomer(){
  const document=customer.document;
  setNotice('');
  const result=await lookup.run(()=>api.get<{fullName:string|null}>(`/foreign-receipts/lookup?document=${encodeURIComponent(document)}`));
  if(result?.fullName){
   const fullName=result.fullName;
   setData(previous=>previous.customer.document===document?{...previous,customer:{...previous.customer,fullName}}:previous);
   setNotice('Cliente encontrado.');
  }else if(result)setNotice('Completa el nombre del cliente.');
 }
 async function findEquipment(index:number,imei:string){
  setNotice('');
  const result=await lookup.run(()=>api.get<{equipment:(Omit<ForeignReceiptDevice,'price'>&{hasSale:boolean})|null}>(`/foreign-receipts/lookup?imei=${encodeURIComponent(imei)}`));
  if(!result)return;
  if(!result.equipment){setNotice('Completa los datos del equipo.');return;}
  const {hasSale,...equipment}=result.equipment;
  setData(previous=>({...previous,devices:previous.devices.map((device,i)=>i===index&&device.imei1===imei?{...device,...equipment}:device)}));
  setNotice(hasSale?'Este equipo tiene una venta asociada. Puedes usar «Desde venta».':'Equipo encontrado.');
 }
 return <form className="foreign-form" onSubmit={event=>{event.preventDefault();onSave(data);}}>
  <fieldset disabled={busy||lookup.busy}>
   <h3>Cliente</h3>
   <div className="form-grid">
    <label>Tipo de documento<select value={customer.type} onChange={event=>setCustomer('type',event.target.value as ForeignReceiptCustomer['type'])}>
     {(['DNI','RUT','CE','PASAPORTE'] as const).map(type=><option key={type}>{type}</option>)}
    </select></label>
    <label>Documento<input required maxLength={40} value={customer.document} onChange={event=>setCustomer('document',event.target.value)}/></label>
    <label>Nombre completo<input required maxLength={201} value={customer.fullName} onChange={event=>setCustomer('fullName',event.target.value)}/></label>
    <label>Fecha y hora de la boleta<input type="datetime-local" required value={data.issuedAt} onChange={event=>setData({...data,issuedAt:event.target.value})}/></label>
   </div>
   {customer.type==='DNI'&&can('clients.read')&&can('equipment.read')&&<button type="button" className="secondary-button" disabled={!/^\d{8}$/.test(customer.document)} onClick={()=>void findCustomer()}>Buscar cliente</button>}
   {devices.map((device,index)=><section className="foreign-device" key={index}>
    <div className="foreign-section-title"><h3>Equipo{devices.length>1?` ${index+1}`:''}</h3>
     {(can('registration.create')||can('sales.create')||can('foreign-receipts.create')||can('foreign-receipts.update'))&&<button type="button" className="secondary-button" aria-expanded={scanner===index} onClick={()=>setScanner(scanner===index?null:index)}>Escanear caja</button>}
    </div>
    {scanner===index&&<BoxScanner equipment={{...device,brand:device.brand??'',model:device.model??''}}
     imeis={[{slot:1,value:device.imei1,type:'PHYSICAL'},{slot:2,value:device.imei2??'',type:'PHYSICAL'}]}
     onDetected={(equipment,imeis)=>setDevice(index,{
      brand:equipment.brand,model:equipment.model,commercialName:equipment.commercialName??'',color:equipment.color??'',
      storage:equipment.storage??'',serialNumber:equipment.serialNumber??'',imei1:imeis[0]?.value??'',imei2:imeis[1]?.value??'',
     })}/>}
    <div className="form-grid">
     <label>IMEI 1<ValidatedInput aria-label="IMEI 1" validateImei required inputMode="numeric" maxLength={15} value={device.imei1} onChange={event=>setDevice(index,{imei1:event.target.value})}/></label>
     <label>IMEI 2<ValidatedInput aria-label="IMEI 2" validateImei inputMode="numeric" maxLength={15} value={device.imei2??''} onChange={event=>setDevice(index,{imei2:event.target.value})}/></label>
     {Object.entries(equipmentFields).map(([field,label])=>{
      const name=field as keyof typeof equipmentFields;
      return <label key={field}>{label}<input required={field==='commercialName'} maxLength={field==='commercialName'?140:80} value={device[name]??''} onChange={event=>setDevice(index,{[name]:event.target.value})}/></label>;
     })}
     <label>Precio (S/)<input required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" maxLength={13} value={device.price} onChange={event=>setDevice(index,{price:event.target.value})}/></label>
    </div>
    {can('clients.read')&&can('equipment.read')&&<button type="button" className="secondary-button" disabled={!/^\d{15}$/.test(device.imei1)} onClick={()=>void findEquipment(index,device.imei1)}>Buscar equipo</button>}
   </section>)}
   <ErrorNotice message={lookup.error}/>
   {notice&&<p className="muted" role="status">{notice}</p>}
   {footer}
  </fieldset>
 </form>;
}
