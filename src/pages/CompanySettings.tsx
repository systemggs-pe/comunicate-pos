import {useState} from 'react';
import {useAuth} from '../app/AuthProvider';
import {useApiQuery} from '../hooks/useApiQuery';
import {useSubmit} from '../hooks/useSubmit';
import {ErrorNotice,Loading,PageHeading} from '../components/common';
import {companySchema,maxReceiptLogoBytes,receiptLogoMimeTypes,type CompanySettings,type CompanyInput} from '../../shared/company';
import {normalizeTypedText} from '../../shared/normalization';
function CompanyForm({saved}:{saved:CompanySettings}){
 const {api,can}=useAuth(),submit=useSubmit();const {id,updatedAt,updatedById,receiptLogo,...initial}=saved;const [input,setInput]=useState<CompanyInput>(initial),[notice,setNotice]=useState(''),[validation,setValidation]=useState(''),[stamp,setStamp]=useState({updatedAt,updatedById});
 const [logo,setLogo]=useState(receiptLogo);
 const logoPath='/settings/company/receipt-logo';
 async function changeLogo(file?:File){
  setNotice('');
  setValidation('');
  if(file&&(!receiptLogoMimeTypes.some(type=>type===file.type)||file.size>maxReceiptLogoBytes)){
   setValidation('Selecciona un logo PNG, JPEG o WebP de hasta 2 MB.');
   return;
  }
  const result=await submit.run(()=>file
   ? api.post<CompanySettings>(logoPath,file)
   : api.request<CompanySettings>(logoPath,'DELETE'));
  if(result){
   setLogo(result.receiptLogo);
   setStamp({updatedAt:result.updatedAt,updatedById:result.updatedById});
   setNotice(file?'Logo guardado para los tickets de venta.':'Logo quitado del ticket de venta.');
  }
 }
 const fields=[['businessName','NOMBRE COMERCIAL',100],['address','DIRECCIÓN',300],['city','CIUDAD',100],['phone','TELÉFONO O CELULAR',30]] as const;
 return <form className="form-panel" onSubmit={async e=>{e.preventDefault();setNotice('');const parsed=companySchema.safeParse(input);if(!parsed.success){setValidation('REVISA LOS DATOS Y LOS MÁRGENES.');return;}setValidation('');const result=await submit.run(()=>api.patch<CompanySettings>('/settings/company',parsed.data));if(result){setStamp({updatedAt:result.updatedAt,updatedById:result.updatedById});setNotice('CONFIGURACIÓN GUARDADA. DIRECCIÓN, CIUDAD, TELÉFONO, FORMATO Y MÁRGENES SE APLICAN A LOS TICKETS.');}}}><fieldset disabled={submit.busy||!can('settings.update')}><h2>DATOS GENERALES</h2><p>El nombre comercial se usa en el expediente de evidencias A4. El ticket conserva COMUNIC@TE y la descripción aprobada.</p><div className="form-grid">{fields.map(([key,label,max])=><label key={key}>{label}<input required={key==='businessName'} type="text" maxLength={max} value={input[key]} onChange={e=>setInput({...input,[key]:key==='phone'?e.target.value:normalizeTypedText(e.target.value)})}/></label>)}</div><h2>CONFIGURACIÓN DEL TICKET</h2>
  <div className="form-grid">
   <label>Logo del ticket<input type="file" accept={receiptLogoMimeTypes.join(',')} aria-describedby="receipt-logo-help" onChange={event=>{
    const file=event.currentTarget.files?.[0];
    event.currentTarget.value='';
    if(file)void changeLogo(file);
   }}/><small id="receipt-logo-help">PNG, JPEG o WebP hasta 2 MB. Se guarda al seleccionarlo.</small></label>
   {logo&&<div>
    <img src={logo.dataUrl} alt="Logo actual del ticket" style={{display:'block',maxWidth:'100%',maxHeight:80,objectFit:'contain'}}/>
    <button type="button" className="secondary-button" onClick={()=>void changeLogo()}>Quitar logo</button>
   </div>}
  </div><label>FORMATO PREDETERMINADO<select aria-label="FORMATO PREDETERMINADO" value={input.defaultFormat??''} onChange={e=>setInput({...input,defaultFormat:e.target.value?Number(e.target.value) as 58|80:null})}><option value="">PREGUNTAR SIEMPRE</option><option value={58}>58 MM — TICKET ORIGINAL</option><option value={80}>80 MM — TICKET ESTÁNDAR</option></select></label><div className="form-grid">{([58,80] as const).map(w=><label key={w}>MARGEN INTERNO {w} MM<input type="number" inputMode="decimal" min={0} max={w===58?5:10} step="0.1" value={input[w===58?'margin58':'margin80']} onChange={e=>setInput({...input,[w===58?'margin58':'margin80']:Number(e.target.value)})}/></label>)}</div><p>EL ANCHO IMPRIMIBLE PUEDE SER MENOR QUE EL PAPEL. AJUSTA LOS MÁRGENES SEGÚN TU IMPRESORA.</p><p>El ticket incluye siempre el número de serie y el pie aprobado. No muestra contacto del cliente ni vendedor.</p>{can('settings.update')&&<button className="primary-button">GUARDAR CONFIGURACIÓN</button>}</fieldset><ErrorNotice message={validation||submit.error}/>{notice&&<p className="success-notice" role="status">{notice}</p>}<p>CONFIGURACIÓN {id} · ACTUALIZACIÓN {new Date(stamp.updatedAt).toLocaleString('es-PE')} · USUARIO {stamp.updatedById??'INICIAL'}</p></form>;
}
export function CompanySettingsPage(){const query=useApiQuery<CompanySettings>('/settings/company');return <section className="admin-mobile company-workspace"><PageHeading title="DATOS DE LA EMPRESA" description="CONFIGURACIÓN DE LA ÚNICA EMPRESA DEL POS."/>{query.loading&&<Loading/>}<ErrorNotice message={query.error?.message} retry={query.refresh}/>{query.data&&<CompanyForm key={query.data.id} saved={query.data}/>}</section>;}
