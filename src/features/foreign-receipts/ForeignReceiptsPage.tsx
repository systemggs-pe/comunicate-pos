import {useRef,useState} from 'react';
import {Download,Printer,ReceiptText,Search,SquarePen} from 'lucide-react';
import {
 foreignIssuerFields,foreignReceiptCreate,foreignReceiptFormats,foreignReceiptIssuer,receiptDateFromPurchase,receiptDateInLima,
 type ForeignReceiptCreate,type ForeignReceiptCustomer,type ForeignReceiptDevice,type ForeignReceiptIssuer,type ForeignReceiptView,
} from '../../../shared/foreign-receipts';
import {Link} from '../../app/router';
import {useAuth} from '../../app/AuthProvider';
import {EmptyState,ErrorNotice,Loading,formatDate} from '../../components/common';
import {useApiQuery} from '../../hooks/useApiQuery';
import {useSubmit} from '../../hooks/useSubmit';
import {money} from '../sales/common';
import {ForeignReceiptManual} from './ForeignReceiptManual';
import {deliverForeignReceipt} from './receipt-download';
import './foreign-receipts.css';

type Mode='sale'|'manual'|'history'|'issuers';
type Issuers=Record<number,ForeignReceiptIssuer>;
type SaleLookup={customer:ForeignReceiptCustomer|null;lines:{id:string;code:string;purchaseAt:string;device:ForeignReceiptDevice}[]};
type ReceiptForm=Omit<Extract<ForeignReceiptCreate,{source:'SALE'}>,'requestKey'>|Omit<Extract<ForeignReceiptCreate,{source:'MANUAL'}>,'requestKey'>;
const endpoint='/foreign-receipts';

function FormatField({value,onChange,issuers}:{value:number;onChange:(value:number)=>void;issuers:Issuers}){
 return <label>Formato PDF<select aria-label="Formato PDF" value={value} onChange={event=>onChange(Number(event.target.value))}>
  {foreignReceiptFormats.map(format=><option key={format.id} value={format.id}>
   {format.label} · {format.currency}{issuers[format.id]?'':' · emisor pendiente'}
  </option>)}
 </select></label>;
}

function SaleOrigin({format,setFormat,issuers,onSave,busy}:{format:number;setFormat:(value:number)=>void;issuers:Issuers;onSave:(value:ReceiptForm)=>void;busy:boolean}){
 const {api}=useAuth(),lookup=useSubmit();
 const [document,setDocument]=useState(''),[result,setResult]=useState<SaleLookup|null>(null),[ids,setIds]=useState<string[]>([]);
 const selected=result?.lines.filter(line=>ids.includes(line.id))??[];
 const dates=selected.length?receiptDateFromPurchase(selected.map(line=>new Date(line.purchaseAt))):null;
 const total=selected.reduce((sum,line)=>sum+Math.round(Number(line.device.price)*100),0);
 return <>
  <form className="foreign-search" onSubmit={async event=>{
   event.preventDefault();setResult(null);setIds([]);
   const found=await lookup.run(()=>api.get<SaleLookup>(`${endpoint}/sales?document=${encodeURIComponent(document)}`));
   if(found)setResult(found);
  }}>
   <label>DNI del cliente<input required inputMode="numeric" pattern="[0-9]{8}" maxLength={8} value={document}
    onChange={event=>{setDocument(event.target.value.replace(/\D/g,''));setResult(null);setIds([]);}} disabled={lookup.busy||busy}/></label>
   <button className="secondary-button" disabled={lookup.busy||busy}><Search size={17} aria-hidden="true"/>{lookup.busy?'Buscando…':'Buscar ventas'}</button>
  </form>
  <ErrorNotice message={lookup.error}/>
  {result&&(!result.lines.length?<EmptyState title="No hay equipos vendidos para este DNI."/>:
   <form className="foreign-form" onSubmit={event=>{event.preventDefault();onSave({source:'SALE',document,saleLineIds:ids,format});}}>
    <fieldset disabled={busy}>
     <legend>Equipos de {result.customer?.fullName}</legend>
     <div className="foreign-sale-list">
      {result.lines.map(line=><label className="foreign-sale-line" key={line.id}>
       <input type="checkbox" checked={ids.includes(line.id)} disabled={!line.device.imei1||Number(line.device.price)<=0||ids.length>=20&&!ids.includes(line.id)}
        onChange={event=>setIds(previous=>event.target.checked?[...previous,line.id]:previous.filter(id=>id!==line.id))}/>
       <span><strong>{line.device.commercialName}</strong><small>{line.code} · {formatDate(line.purchaseAt)}</small>
        <small>{[line.device.imei1,line.device.imei2].filter(Boolean).join(' · ')||'IMEI pendiente'}</small></span>
       <b>{money(line.device.price)}</b>
      </label>)}
     </div>
     <FormatField value={format} onChange={setFormat} issuers={issuers}/>
     {dates&&<div className="foreign-totals"><div><small>Compra más reciente</small><strong>{formatDate(dates.purchaseAt.toISOString())}</strong></div>
      <div><small>Fecha de la boleta</small><strong>{formatDate(dates.issuedAt.toISOString())}</strong></div>
      <div><small>Total seleccionado</small><strong>{money((total/100).toFixed(2))}</strong></div></div>}
     <div className="form-actions"><button className="primary-button" disabled={!selected.length||!issuers[format]}>{busy?'Guardando…':'Generar boleta'}</button></div>
    </fieldset>
   </form>)}
 </>;
}

function IssuerEditor({format,config,onSaved}:{format:number;config:ForeignReceiptIssuer|undefined;onSaved:()=>void}){
 const {api}=useAuth(),submit=useSubmit(),[logo,setLogo]=useState(config?.logoDataUrl??''),[logoError,setLogoError]=useState(''),[logoBusy,setLogoBusy]=useState(false),[saved,setSaved]=useState(false);
 return <form className="foreign-form" onSubmit={async event=>{
  event.preventDefault();setSaved(false);
  const values=Object.fromEntries(new FormData(event.currentTarget));
  if(await submit.run(()=>api.patch(`${endpoint}/issuers/${format}`,foreignReceiptIssuer.parse({...values,logoDataUrl:logo})))){setSaved(true);onSaved();}
 }}>
  <fieldset disabled={submit.busy||logoBusy}>
   <div className="form-grid">{Object.entries(foreignIssuerFields).slice(0,17).map(([key,label])=><label key={key}>{label}
    <input name={key} required={key==='nombre'||key==='rut'||key==='tipoCambioPenUsd'&&format>=4&&format<=6}
     maxLength={key==='rut'?40:400} defaultValue={config?.[key as keyof ForeignReceiptIssuer]??''}/></label>)}</div>
   <details className="foreign-issuer-extra"><summary>Campos adicionales del formato</summary>
    <div className="form-grid">{Object.entries(foreignIssuerFields).slice(17).map(([key,label])=><label key={key}>{label}
     <input name={key} maxLength={400} defaultValue={config?.[key as keyof ForeignReceiptIssuer]??''}/></label>)}</div>
   </details>
   <label>Logo del emisor<input type="file" accept="image/png,image/jpeg" onChange={event=>{
    const file=event.target.files?.[0];setLogoError('');
    if(!file)return;
    if(!['image/png','image/jpeg'].includes(file.type)||file.size>12500){setLogoError('Usa un PNG o JPEG de hasta 12 KB.');return;}
    setLogoBusy(true);
    const reader=new FileReader();reader.onload=()=>setLogo(String(reader.result??''));
    reader.onerror=()=>setLogoError('No se pudo leer el logo.');
    reader.onloadend=()=>setLogoBusy(false);reader.readAsDataURL(file);
   }}/></label>
   {logo&&<div className="foreign-logo"><img src={logo} alt="Logo del emisor"/><button type="button" className="text-button" onClick={()=>setLogo('')}>Quitar logo</button></div>}
   <div className="form-actions"><button className="primary-button">{submit.busy?'Guardando…':'Guardar emisor'}</button></div>
  </fieldset>
  <ErrorNotice message={submit.error||logoError}/>
  {saved&&<p role="status" className="foreign-result">Emisor guardado.</p>}
 </form>;
}

function ReceiptHistory({show}:{show:(receipt:ForeignReceiptView)=>void}){
 const [type,setType]=useState('document'),[value,setValue]=useState(''),[search,setSearch]=useState({by:'document',q:''});
 const [cursors,setCursors]=useState<number[]>([]);
 const before=cursors.at(-1);
 const query=useApiQuery<{rows:ForeignReceiptView[];next:number|null}>(`${endpoint}?by=${search.by}&q=${encodeURIComponent(search.q)}${before?`&before=${before}`:''}`);
 return <>
  <form className="foreign-search" onSubmit={event=>{event.preventDefault();setSearch({by:type,q:value.trim()});setCursors([]);}}>
   <label>Buscar por<select aria-label="Buscar por" value={type} onChange={event=>setType(event.target.value)}>
    <option value="document">Documento</option><option value="imei">IMEI</option><option value="folio">Folio</option>
   </select></label>
   <label>Valor de búsqueda<input value={value} maxLength={40} onChange={event=>setValue(event.target.value)}/></label>
   <button className="secondary-button"><Search size={17} aria-hidden="true"/>Buscar</button>
  </form>
  {query.loading&&<Loading/>}
  <ErrorNotice message={query.error?.message} retry={query.error?query.refresh:undefined}/>
  {query.data&&(!query.data.rows.length?<EmptyState title="Sin boletas para esta búsqueda."/>:
   <ul className="foreign-history">{query.data.rows.map(row=><li key={row.id}>
    <button type="button" onClick={()=>show(row)} className="foreign-history-row">
     <strong>Folio {row.folio}</strong><span>{row.snapshot.customer.fullName}<small>{row.snapshot.devices.map(device=>device.commercialName).join(' · ')}</small></span>
     <span>{formatDate(row.issuedAt)}<small>{money(row.totalPen)}</small></span>
    </button>
   </li>)}</ul>)}
  {(!!cursors.length||query.data?.next)&&<div className="form-actions">
   <button className="secondary-button" type="button" disabled={!cursors.length} onClick={()=>setCursors(previous=>previous.slice(0,-1))}>Anterior</button>
   <button className="secondary-button" type="button" disabled={!query.data?.next} onClick={()=>{const next=query.data?.next;if(next)setCursors(previous=>[...previous,next]);}}>Siguiente</button>
  </div>}
 </>;
}

function ReceiptEdit({receipt,issuers,busy,cancel,save}:{receipt:ForeignReceiptView;issuers:Issuers;busy:boolean;cancel:()=>void;save:(input:object)=>void}){
 const [format,setFormat]=useState(receipt.format),[date,setDate]=useState(receiptDateInLima(receipt.issuedAt));
 const footer=<><FormatField value={format} onChange={setFormat} issuers={issuers}/>
  <div className="form-actions"><button type="button" className="secondary-button" onClick={cancel}>Cancelar</button>
   <button className="primary-button" disabled={format!==receipt.format&&!issuers[format]}>{busy?'Guardando…':'Guardar cambios'}</button></div></>;
 const base={format,expectedUpdatedAt:receipt.updatedAt};
 return receipt.source==='SALE'?<form className="foreign-form" onSubmit={event=>{
  event.preventDefault();save({...base,...(date!==receiptDateInLima(receipt.issuedAt)?{issuedAt:date}:{})});
 }}><fieldset disabled={busy}>
  <p className="muted">Los equipos y los precios se conservan desde la venta vinculada.</p>
  <label>Fecha y hora de la boleta<input type="datetime-local" required value={date} onChange={event=>setDate(event.target.value)}/></label>
  {footer}
 </fieldset></form>:<ForeignReceiptManual initial={{customer:receipt.snapshot.customer,devices:receipt.snapshot.devices,issuedAt:date}}
  busy={busy} onSave={manual=>save({...base,manual})} footer={footer}/>;
}

export function ForeignReceiptsPage(){
 const {api,can}=useAuth(),submit=useSubmit(),pdf=useSubmit();
 const [mode,setMode]=useState<Mode>(can('foreign-receipts.create')?(can('sales.read')?'sale':'manual'):'history');
 const [format,setFormat]=useState(1),[issuerFormat,setIssuerFormat]=useState(1);
 const [current,setCurrent]=useState<ForeignReceiptView|null>(null),[editing,setEditing]=useState(false);
 const [notice,setNotice]=useState(''),[revision,setRevision]=useState(0);
 const request=useRef<{body:string;key:string}|null>(null);
 const issuerQuery=useApiQuery<Issuers>(`${endpoint}/issuers`),issuers=issuerQuery.data??{};
 const canCreate=can('foreign-receipts.create'),canConfigure=can('foreign-receipts.issuers');
 const modes:{id:Mode;label:string;visible:boolean}[]=[
  {id:'sale',label:'Desde venta',visible:canCreate&&can('sales.read')},
  {id:'manual',label:'Registro manual',visible:canCreate},
  {id:'history',label:'Historial',visible:true},
  {id:'issuers',label:'Emisores',visible:canConfigure},
 ];
 async function create(data:ReceiptForm){
  const body=JSON.stringify(data);
  if(request.current?.body!==body)request.current={body,key:crypto.randomUUID()};
  const requestKey=request.current.key;
  const result=await submit.run(()=>api.post<{receipt:ForeignReceiptView;existing:boolean}>(endpoint,foreignReceiptCreate.parse({...data,requestKey})));
  if(!result)return;
  setCurrent(result.receipt);setRevision(value=>value+1);
  setNotice(result.existing?'El equipo ya tiene esta boleta vinculada.':'Boleta guardada.');
  if(!result.existing)await pdf.run(()=>deliverForeignReceipt(result.receipt));
 }
 async function update(data:object){
  if(!current)return;
  const result=await submit.run(()=>api.patch<ForeignReceiptView>(`${endpoint}/${current.id}`,data));
  if(result){setCurrent(result);setEditing(false);setRevision(value=>value+1);setNotice('Boleta actualizada.');}
 }
 return <section className="reference-panel foreign-workspace">
  <header className="foreign-header"><span className="module-icon"><ReceiptText size={22} aria-hidden="true"/></span>
   <div><h1>Boletas extranjeras</h1><p>Genera desde una venta o consulta una boleta guardada.</p></div>
   <Link className="text-button" to="/boleta" target="_blank" rel="noopener noreferrer">Consulta pública</Link>
  </header>
  <nav className="foreign-modes" aria-label="Opciones de boletas">{modes.filter(item=>item.visible).map(item=><button type="button" key={item.id}
   aria-pressed={mode===item.id&&!editing} disabled={submit.busy} onClick={()=>{setMode(item.id);setEditing(false);setCurrent(null);setNotice('');}}>{item.label}</button>)}</nav>
  <div className="foreign-content">
   {current&&!editing&&<section className="foreign-result" aria-label="Boleta seleccionada">
    {notice&&<p role="status">{notice}</p>}
    <div className="foreign-section-title"><div><h2>Boleta {current.folio}</h2>
     <p>{current.snapshot.customer.fullName} · {formatDate(current.issuedAt)}</p>
     <p className="muted">{current.snapshot.devices.map(item=>item.commercialName).join(' · ')}</p></div></div>
    <div className="form-actions">
     <button type="button" className="primary-button" disabled={pdf.busy} onClick={()=>void pdf.run(()=>deliverForeignReceipt(current))}><Download size={17}/>Descargar PDF</button>
     <button type="button" className="secondary-button" disabled={pdf.busy} onClick={()=>void pdf.run(()=>deliverForeignReceipt(current,true))}><Printer size={17}/>Imprimir</button>
     {can('foreign-receipts.update')&&<button type="button" className="secondary-button" onClick={()=>setEditing(true)}><SquarePen size={17}/>Editar</button>}
    </div>
   </section>}
   {editing&&current?<><h2>Editar boleta {current.folio}</h2><ReceiptEdit key={current.id} receipt={current} issuers={issuers} busy={submit.busy}
    cancel={()=>setEditing(false)} save={data=>void update(data)}/></>:<>
    {(mode==='sale'||mode==='manual')&&!issuerQuery.loading&&!issuers[format]&&<p className="foreign-result">
     Este formato requiere un emisor configurado. {canConfigure&&<button type="button" className="text-button" onClick={()=>{setIssuerFormat(format);setMode('issuers');}}>Configurar emisor</button>}</p>}
    {mode==='sale'&&<SaleOrigin format={format} setFormat={setFormat} issuers={issuers} busy={submit.busy} onSave={data=>void create(data)}/>}
    {mode==='manual'&&<ForeignReceiptManual busy={submit.busy} onSave={data=>void create({source:'MANUAL',format,...data})}
     footer={<><FormatField value={format} onChange={setFormat} issuers={issuers}/><div className="form-actions">
      <button className="primary-button" disabled={!issuers[format]}>{submit.busy?'Guardando…':'Generar boleta'}</button></div></>}/>}
    {mode==='history'&&<ReceiptHistory key={revision} show={row=>{setCurrent(row);setNotice('');}}/>}
    {mode==='issuers'&&<><FormatField value={issuerFormat} onChange={setIssuerFormat} issuers={issuers}/>
     {notice&&<p role="status" className="foreign-result">{notice}</p>}
     {issuerQuery.loading?<Loading/>:<IssuerEditor key={issuerFormat} format={issuerFormat} config={issuers[issuerFormat]} onSaved={()=>{setNotice('Emisor guardado.');issuerQuery.refresh();}}/>}</>}
   </>}
   <ErrorNotice message={submit.error||pdf.error||issuerQuery.error?.message}/>
  </div>
 </section>;
}
