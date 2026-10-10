import {normalizeTypedText} from '../../../shared/normalization';
import { limaDateTimeNow,limaDateTimeIso } from '../../../shared/operational-date';
import { AccessoriesEditor } from './AccessoriesEditor';

import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';

import type { SaleAccessory } from '../../types/pos';

import { FormValidation, FieldScope, ValidatedInput } from '../../components/FormValidation';
import { useRef, useState } from 'react';

import { useApi } from '../../app/ApiProvider';

import { navigate } from '../../app/router';

import { useSubmit } from '../../hooks/useSubmit';

import { saleFlowSchema, cents, decimalMoney } from '../../../shared/sales';

import { ClientPicker } from '../clients/ClientPicker';

import { SaleEquipmentEditor, emptySaleItem } from './SaleEquipmentEditor';

import { money, paymentLabels, ClientName, SaleReviewItem } from './common';

import { ErrorNotice, PageHeading } from '../../components/common';

import type { ClientReference, PaymentMethod, Sale, SaleInput } from '../../types/pos';



export function NewSale() {

  const { api } = useApi(); const form=useRef<HTMLFormElement>(null); const submit = useSubmit(form); const [buyer, setBuyer] = useState<ClientReference | null>(null), [items, setItems] = useState([{ key: 1, value: emptySaleItem(), ownerRequired: false }]), [counter, setCounter] = useState(2);

  const [method, setMethod] = useState<PaymentMethod>('CASH'), [discount, setDiscount] = useState('0'), [notes, setNotes] = useState('');

  const [accessories,setAccessories]=useState<SaleAccessory[]>([]),[date,setDate]=useState(limaDateTimeNow),[saved,setSaved]=useState(false);

  useUnsavedChanges(!saved&&(!!buyer||items.some(row=>!!row.value.unitPrice||row.value.equipment?.imeis.some(i=>!!i.value)||!!row.value.equipment?.brand)||accessories.length>0||!!notes||discount!=='0'));

  const [review, setReview] = useState<{ input: SaleInput; subtotal: string; total: string } | null>(null);

  let preview: string | null = null; try { preview = decimalMoney(items.reduce((sum, item) => sum + cents(item.value.unitPrice), 0n) + accessories.reduce((sum,line)=>sum+cents(line.unitPrice)*BigInt(line.quantity),0n) - cents(discount)); } catch { /* Campos incompletos: mostrar instrucción, sin inventar total. */ }

  return <><PageHeading title="Nueva venta" description="Comprador, equipos y precios en una sola operación." /><FormValidation errors={submit.fields}><form ref={form} onSubmit={async e => {

    e.preventDefault(); if (review) { const result = await submit.run(() => api.post<Sale>('/sales', review.input)); if (result) {setSaved(true); window.dispatchEvent(new Event('pos:form-saved')); navigate(`/ventas/${result.id}?saved=1`); } }

    else { const result = await submit.run(async () => { if (items.some(item => item.ownerRequired && !item.value.owner)) throw new Error('Selecciona todos los propietarios distintos del comprador.'); const input = saleFlowSchema.parse({ buyer, items: items.map(item => ({ ...item.value, equipment: item.value.equipment ? { ...item.value.equipment, serialNumber: item.value.equipment.serialNumber?.trim() || null } : undefined })), paymentMethod: method, discount, notes, accessories, occurredAt:limaDateTimeIso(date), idempotencyKey:crypto.randomUUID() }); const totals = await api.post<{ subtotal: string; total: string }>('/sales/resolve', input); return { input, ...totals }; }); if (result) setReview(result); }

  }}><fieldset disabled={submit.busy}>{!review ? <><div className="form-panel"><h2>1. Datos del comprador</h2><p className="form-hint">Documento disponible: DNI. Celular y correo opcionales.</p><FieldScope prefix="buyer.client"><ClientPicker label="Comprador" value={buyer} onChange={setBuyer} /></FieldScope></div><div className="section-heading"><h2>2. Equipos de la venta</h2><button type="button" className="secondary-button" onClick={() => { setItems(values => [...values, { key: counter, value: emptySaleItem(), ownerRequired: false }]); setCounter(value => value + 1); }} disabled={items.length >= 20}>Agregar equipo</button></div>{items.map((item, index) => <SaleEquipmentEditor key={item.key} item={item.value} index={index} onChange={value => setItems(values => values.map(row => row.key === item.key ? { ...row, value } : row))} onOwnerRequiredChange={required => setItems(values => values.map(row => row.key === item.key ? { ...row, ownerRequired: required } : row))} onRemove={() => setItems(values => values.filter(row => row.key !== item.key))} />)}{!items.length && <p className="muted">Agrega al menos un equipo para continuar.</p>}<AccessoriesEditor value={accessories} onChange={setAccessories} /><div className="form-panel"><div className="form-grid"><label>Fecha y hora de venta<input type="datetime-local" required value={date} onChange={e=>setDate(e.target.value)} /></label><label>Método de pago<select value={method} onChange={e => setMethod(e.target.value as PaymentMethod)}>{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Descuento de la venta (S/)<ValidatedInput name="discount" aria-label="Descuento de la venta (S/)" inputMode="decimal" value={discount} onChange={e => setDiscount(e.target.value)} /></label><label>Notas opcionales<textarea maxLength={1000} value={notes} onChange={e => setNotes(normalizeTypedText(e.target.value))} /></label></div><p className="sale-total">Total estimado: <strong>{preview === null ? 'Completa los precios' : money(preview)}</strong></p><p className="form-hint">Los IMEIs permanecerán sin registrar. Antes de confirmar se comprobarán todos los valores.</p></div></> : <section className="form-panel sale-review" aria-label="Resumen final"><h2>Resumen de venta</h2><p>Comprador: <ClientName reference={review.input.buyer} /></p>{review.input.items.map((item, index) => <SaleReviewItem key={index} item={item} index={index} />)}<h3>Accesorios</h3>{review.input.accessories?.map((line,index)=><p key={index}>{line.name} × {line.quantity} · {money(line.unitPrice)} · Importe {money(decimalMoney(cents(line.unitPrice)*BigInt(line.quantity)))}</p>)}<p>Fecha de venta: {new Date(review.input.occurredAt!).toLocaleString('es-PE',{timeZone:'America/Lima'})}</p><dl className="totals"><div><dt>Equipos</dt><dd>{review.input.items.length}</dd></div><div><dt>Método</dt><dd>{paymentLabels[review.input.paymentMethod]}</dd></div><div><dt>Subtotal</dt><dd>{money(review.subtotal)}</dd></div><div><dt>Descuento</dt><dd>{money(review.input.discount)}</dd></div><div><dt>Total</dt><dd><strong>{money(review.total)}</strong></dd></div></dl><p className="form-hint">Confirma la compra. El propietario y registro de IMEIs son datos independientes.</p></section>}<ErrorNotice message={submit.error} /><div className="form-actions">{review && <button type="button" className="secondary-button" onClick={() => setReview(null)}>Volver a editar</button>}<button className="primary-button">{submit.busy ? 'Procesando venta...' : review ? 'Confirmar venta' : 'Revisar venta'}</button></div></fieldset></form></FormValidation></>;

}
