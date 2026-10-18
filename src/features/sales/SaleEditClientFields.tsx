import {useState} from 'react';
import {useDniLookup} from '../../hooks/useDniLookup';
import {ValidatedInput} from '../../components/FormValidation';
import {asClientInput,emptyClient} from '../clients/ClientFields';
import {displayClientName} from '../clients/displayName';
import type {Sale,ClientReference} from '../../types/pos';

export function SaleEditClientFields({sale,onChange}:{sale:Sale;onChange:(value:ClientReference|null)=>void}){
 const [draft,setDraft]=useState({...emptyClient,dni:sale.buyer.dni,fullName:displayClientName(sale.buyer)});
 const original=draft.dni===sale.buyer.dni;
 const lookup=useDniLookup(original?emptyClient:draft,value=>{setDraft({...value,fullName:value.fullName??''});onChange({client:asClientInput(value)});});
 return <><div className="document-number"><label>Documento *<select aria-label="Tipo de documento" disabled value="DNI"><option>DNI</option></select></label><label><span className="sr-only">Número de DNI</span><ValidatedInput name="buyer.client.dni" aria-label="DNI del comprador" required inputMode="numeric" maxLength={8} value={draft.dni} onChange={event=>{const dni=event.target.value;const next={...emptyClient,dni,fullName:dni===sale.buyer.dni?displayClientName(sale.buyer):''};setDraft(next);onChange(dni===sale.buyer.dni?{id:sale.buyerId}:null);}}/></label></div><label>Nombre *<ValidatedInput name="buyer.client.fullName" aria-label="Nombre del comprador" required maxLength={201} readOnly={original||!!lookup.localClient} value={original?displayClientName(sale.buyer):lookup.localClient?displayClientName(lookup.localClient):draft.fullName} onChange={event=>{const next={...draft,fullName:event.target.value};setDraft(next);onChange({client:asClientInput(next)});}}/></label>{lookup.loading&&<p role="status">Consultando DNI…</p>}{lookup.error&&<p role="status">{lookup.error.message} Completa el nombre manualmente.</p>}</>;
}
