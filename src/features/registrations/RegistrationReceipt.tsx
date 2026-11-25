import {useEffect,useState} from 'react';
import {ReceiptText} from 'lucide-react';
import {activeForeignReceiptFormats} from '../../../shared/foreign-receipts';
import {registrationReceiptChoice,type ReceiptCandidate,type RegistrationReceiptChoice,type RegistrationReceiptOptions} from '../../../shared/registration-receipt';
import {useApi} from '../../app/ApiProvider';
import {ErrorNotice,formatDate} from '../../components/common';
import {money} from '../sales/common';
import type {ImeiInput} from '../../types/pos';

const title=(candidate:ReceiptCandidate)=>candidate.kind==='FOREIGN'?
 `Folio ${candidate.folio} · ${candidate.issuer||'Emisor registrado'} · ${formatDate(candidate.date)}`:
 `${candidate.originalPdf?'PDF original':'Foto de la boleta'} · ${formatDate(candidate.date)}`;
const noChoice={key:'',picked:'',format:0,price:'',date:''};

export function useRegistrationReceipt(input:{dni:string;imeis:ImeiInput[];equipmentId?:string}|null,hasUpload:boolean){
 const {api}=useApi();
 const key=input?JSON.stringify(input):'';
 const [revision,setRevision]=useState(0);
 const queryKey=`${key}:${revision}`;
 const [result,setResult]=useState<{key:string;options?:RegistrationReceiptOptions;error?:string}>({key:''});
 const [draft,setDraft]=useState(noChoice);
 const current=draft.key===key?draft:noChoice;
 const update=(fields:Partial<typeof noChoice>)=>setDraft(previous=>({...(previous.key===key?previous:noChoice),key,...fields}));
 useEffect(()=>{
  if(!key)return;
  const controller=new AbortController();
  void api.request<RegistrationReceiptOptions>('/registration-receipts/resolve','POST',JSON.parse(key),controller.signal)
   .then(options=>{if(!controller.signal.aborted)setResult({key:queryKey,options});})
   .catch(error=>{if(!controller.signal.aborted)setResult({key:queryKey,error:error instanceof Error?error.message:'No se pudo buscar la boleta.'});});
  return()=>controller.abort();
 },[api,key,queryKey]);
 const options=result.key===queryKey?result.options:undefined;
 const error=key&&result.key===queryKey?result.error:undefined;
 const loading=!!key&&result.key!==queryKey;
 const formats=options?.formats??[];
 const candidates=options?.candidates??[];
 const needsReview=candidates.some(row=>row.kind==='FOREIGN'&&row.needsReview);
 const candidate=candidates.find(row=>row.id===current.picked)??(!hasUpload&&!needsReview&&candidates.length===1?candidates[0]:undefined);
 const format=formats.includes(current.format)?current.format:formats[0];
 const useUpload=hasUpload&&current.picked==='upload';
 const manual=current.picked==='manual'&&!hasUpload;
 let choice:RegistrationReceiptChoice|undefined;
 if(!useUpload&&candidate)choice=candidate.kind==='FOREIGN'?{kind:'FOREIGN',id:candidate.id,version:candidate.version}:{kind:'STORED',id:candidate.id};
 else if(!candidates.length&&!hasUpload&&options?.sale&&Number(options.sale.price)>0&&format)choice={kind:'SALE',format};
 else if(!candidates.length&&manual&&format){
  const parsed=registrationReceiptChoice.safeParse({kind:'MANUAL',format,issuedAt:current.date,price:current.price});
  if(parsed.success)choice=parsed.data;
 }
 const blocked=!!key&&(loading||!!error||!choice&&!useUpload&&(candidates.length>0||manual));
 const missing=!!key&&!choice&&!hasUpload;
 function retry(){setDraft(noChoice);setRevision(value=>value+1);}
 return {options,error,loading,choice,candidate,blocked,missing,formats,format,manual,hasUpload,useUpload,needsReview,current,update,retry};
}

export function RegistrationReceiptPanel({state}:{state:ReturnType<typeof useRegistrationReceipt>}){
 const {options,loading,error,formats,format,candidate,choice,manual,current,hasUpload,useUpload,needsReview,update,retry}=state;
 const candidates=options?.candidates??[];
 if(loading)return <p className="form-hint" role="status">Buscando boleta del equipo…</p>;
 if(error)return <ErrorNotice message={error} retry={retry}/>;
 if(!options)return null;
 const formatField=<label>Formato de la boleta<select aria-label="Formato de la boleta" value={format??''} onChange={event=>update({format:Number(event.target.value)})}>
  {activeForeignReceiptFormats.filter(item=>formats.includes(item.id)).map(item=><option key={item.id} value={item.id}>{item.label} · {item.currency}</option>)}
 </select></label>;
 return <div className="registration-receipt">
  {candidate&&!useUpload&&<div className="registration-receipt-match" role="status"><ReceiptText size={18} aria-hidden="true"/><div>
   <strong>{current.picked===candidate.id?'Boleta seleccionada':'Adjuntada automáticamente'}</strong><p>{title(candidate)}</p>
  </div></div>}
  {needsReview&&<p className="form-hint">Hay una boleta histórica con un documento de cliente distinto. Revisa el folio antes de usarla.</p>}
  {!!candidates.length&&(candidates.length>1||hasUpload||needsReview)&&<label>Boleta para el expediente<select aria-label="Boleta para el expediente"
   value={useUpload?'upload':candidate?.id??''} onChange={event=>update({picked:event.target.value})}>
   <option value="">Elige la boleta que quieres adjuntar</option>
   {candidates.map(item=><option key={item.id} value={item.id}>{title(item)}</option>)}
   {hasUpload&&<option value="upload">Usar el archivo cargado</option>}
  </select></label>}
  {!candidates.length&&options.sale&&!hasUpload&&<div className="registration-receipt-match"><ReceiptText size={18} aria-hidden="true"/><div>
   <strong>{choice?'Se generará desde la venta':'Venta vinculada al equipo'}</strong>
   <p>{options.sale.code} · {money(options.sale.price)} · {formatDate(options.sale.issuedAt)}</p>
  </div></div>}
  {!candidates.length&&options.sale&&!hasUpload&&Number(options.sale.price)>0&&!!formats.length&&formatField}
  {!candidates.length&&options.sale&&!hasUpload&&Number(options.sale.price)<=0&&<p className="form-hint">La línea de venta necesita un precio mayor que cero. Corrígelo en Ventas o adjunta el original.</p>}
  {!candidates.length&&options.sold&&!hasUpload&&!formats.length&&<p className="form-hint">Para generar la boleta se necesita acceso a la venta y un emisor configurado. También puedes adjuntar el documento original.</p>}
  {!candidates.length&&!options.sold&&!hasUpload&&!!formats.length&&<>
   <p className="form-hint">Completa los datos de la boleta o adjunta el original para continuar.</p>
   <button type="button" className="secondary-button" aria-expanded={manual} onClick={()=>update({picked:manual?'':'manual'})}>Completar datos de la boleta</button>
   {manual&&<div className="registration-receipt-manual">
    <label>Importe de compra (S/)<input aria-label="Importe de compra (S/)" name="receipt.price" inputMode="decimal" value={current.price} onChange={event=>update({price:event.target.value})}/></label>
    <label>Fecha declarada de la boleta<input aria-label="Fecha declarada de la boleta" name="receipt.issuedAt" type="datetime-local" value={current.date} onChange={event=>update({date:event.target.value})}/></label>
    {formatField}
    <p className="form-hint">Se usarán los datos del cliente y del equipo que ya ingresaste.</p>
   </div>}
  </>}
  {!candidates.length&&!options.sold&&!hasUpload&&!formats.length&&<p className="form-hint">Puedes subir el original. Para generar una boleta manual se requiere permiso de emisión y un emisor configurado.</p>}
 </div>;
}
