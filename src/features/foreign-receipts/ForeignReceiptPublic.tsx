import {useState} from 'react';
import {ReceiptText} from 'lucide-react';
import {ErrorNotice} from '../../components/common';
import {apiUrl} from '../../services/api';
import './foreign-receipts.css';

type Verification={found:boolean;folio?:number;issuer?:string};
export function ForeignReceiptPublic(){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Verification|null>(null);
 return <main className="design-shell foreign-public">
  <section className="reference-panel foreign-public-panel">
   <span className="module-icon"><ReceiptText size={22} aria-hidden="true"/></span>
   <h1>Consultar boleta</h1>
   <p className="muted">Comprueba si una boleta figura en el historial de COMUNIC@TE.</p>
   <form onSubmit={async event=>{
    event.preventDefault();
    if(busy)return;
    const data=new FormData(event.currentTarget);
    setBusy(true);setError('');setResult(null);
    try{
     const response=await fetch(apiUrl('/public/foreign-receipts/verify'),{method:'POST',credentials:'omit',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(data)),
      signal:AbortSignal.timeout(20000)});
     const value=await response.json();
     if(!response.ok)throw Error(value?.error?.message??'No se pudo consultar.');
     setResult(value);
    }catch(cause){setError(cause instanceof Error?cause.message:'No se pudo consultar.');}
    finally{setBusy(false);}
   }}>
    <fieldset disabled={busy} className="form-grid">
     <label>Documento del emisor<input name="issuerDocument" required maxLength={40}/></label>
     <label>Folio<input name="folio" required inputMode="numeric" pattern="[0-9]+" maxLength={10}/></label>
     <label>Fecha de la boleta<input name="date" required type="date"/></label>
     <label>Importe en la moneda de la boleta<input name="amount" required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" maxLength={17}/></label>
    </fieldset>
    <button className="primary-button" disabled={busy}>{busy?'Consultando…':'Consultar boleta'}</button>
   </form>
   <ErrorNotice message={error}/>
   {result&&<div className="foreign-result" role="status">
    <strong>{result.found?`Boleta ${result.folio} encontrada`:'Sin coincidencias'}</strong>
    <p>{result.found?result.issuer:'Revisa los datos e inténtalo de nuevo.'}</p>
   </div>}
  </section>
 </main>;
}
