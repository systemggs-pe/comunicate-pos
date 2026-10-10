import { useState } from 'react';
import { useApi } from '../../app/ApiProvider';
import { navigate } from '../../app/router';
import { useDniLookup } from '../../hooks/useDniLookup';
import { DniClientFields } from '../clients/DniClientFields';
import { useSubmit } from '../../hooks/useSubmit';
import { clientSchema, equipmentEditSchema, resolveRegistrationSchema, registrationFlowSchema } from '../../../shared/validation';
import { isDualImei } from '../../../shared/registration';
import { emptyClient, asClientInput, type ClientFieldsValue } from '../clients/ClientForm';
import { EquipmentFields } from '../equipment/EquipmentForm';
import { RegistrationFields } from '../equipment/ImeiCard';
import { ErrorNotice, PageHeading, StatusBadge } from '../../components/common';
import type { Equipment, EquipmentInput, ImeiInput, RegistrationResolution, RegistrationStatus } from '../../types/pos';

export function RegistrationFlow() {
  const { api } = useApi(); const submit = useSubmit();
  const [step, setStep] = useState(0), [draft, setDraft] = useState<ClientFieldsValue>(emptyClient), [client, setClient] = useState(emptyClient);
  const lookup = useDniLookup(draft, setDraft);
  const [imeis, setImeis] = useState<ImeiInput[]>([{ slot: 1, value: '', type: 'PHYSICAL' }]);
  const [resolution, setResolution] = useState<RegistrationResolution | null>(null), [confirmed, setConfirmed] = useState(false);
  const [equipment, setEquipment] = useState<EquipmentInput>({ brand: '', model: '', serialNumber: '' });
  const [selected, setSelected] = useState<string[]>([]), [status, setStatus] = useState<RegistrationStatus>('PENDING'), [method, setMethod] = useState('');
  const steps = ['Cliente', 'IMEIs', 'Equipo', 'Registro'];
  async function advance() {
    await submit.run(async () => {
      if (step === 0) {
        if (lookup.loading) throw new Error('Espera la búsqueda del DNI.');
        const value = lookup.localClient ? { ...lookup.localClient, phone: lookup.localClient.phone ?? '', email: lookup.localClient.email ?? '',address:lookup.localClient.address??'',department:lookup.localClient.department??'' } : draft;
        const parsed = clientSchema.parse(asClientInput(value)); setClient({ ...value, ...parsed, phone: parsed.phone ?? '', email: parsed.email ?? '',address:parsed.address??'',department:parsed.department??'' });
      } else if (step === 1) {
        const input = resolveRegistrationSchema.parse({ dni: client.dni, imeis });
        const result = await api.post<RegistrationResolution>('/registrations/resolve', input);
        const availableImeis = result.equipment
          ? [...result.equipment.imeis.map(({ slot, value, type }) => ({ slot, value, type })), ...result.additions].sort((a, b) => a.slot - b.slot)
          : input.imeis;
        setResolution(result); setConfirmed(false); setImeis(availableImeis); setSelected([input.imeis[0].value]);
      } else if (step === 2) {
        if (resolution?.kind === 'NEW') setEquipment(equipmentEditSchema.parse({ ...equipment, serialNumber: equipment.serialNumber?.trim() || null }));
        if (resolution?.requiresConfirmation && !confirmed) throw new Error('Confirma la asociación del nuevo IMEI al equipo existente.');
      } else {
        const input = registrationFlowSchema.parse({ client: asClientInput(client), imeis, selectedImeis: selected, registration: { status, method: method.trim() || null }, equipment: resolution?.kind === 'NEW' ? equipment : undefined, expectedEquipmentId: resolution?.equipment?.id, confirmAddImei: confirmed });
        const result = await api.post<Equipment>('/registrations', input); navigate(`/equipos/${result.id}?saved=1`); return;
      }
      setStep(value => value + 1);
    });
  }
  return <><PageHeading title="Nuevo registro" description="Busca primero. Reutiliza el cliente y el equipo cuando ya existen." />
    <ol className="steps" aria-label="Pasos del registro">{steps.map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined} className={step === index ? 'current' : ''}><span>{index + 1}</span>{label}</li>)}</ol>
    <form className="form-panel" onSubmit={e => { e.preventDefault(); void advance(); }}><fieldset disabled={submit.busy}><legend>{steps[step]}</legend>
      {step === 0 && <DniClientFields value={draft} onChange={setDraft} lookup={lookup} />}
      {step === 1 && <><p className="muted">{client.firstName} {client.lastName} · DNI {client.dni}</p>{imeis.map((imei, index) => <div className="form-grid imei-input-row" key={imei.slot}><label>IMEI {imei.slot}<input inputMode="numeric" autoComplete="off" required={imei.slot === 1} maxLength={24} value={imei.value} onChange={e => setImeis(values => values.map((value, i) => i === index ? { ...value, value: e.target.value } : value))} /><span className="form-hint">15 dígitos, sin letras.</span></label><label>Tipo IMEI {imei.slot}<select value={imei.type} onChange={e => setImeis(values => values.map((value, i) => i === index ? { ...value, type: e.target.value as ImeiInput['type'] } : value))}><option value="PHYSICAL">Físico</option><option value="ESIM">eSIM</option></select></label></div>)}<label className="checkbox-label"><input type="checkbox" checked={imeis.length === 2} onChange={e => setImeis(values => e.target.checked ? [...values, { slot: 2, value: '', type: 'PHYSICAL' }] : values.slice(0, 1))} />El equipo tiene un segundo IMEI</label><p className="form-hint">Se comprobarán ambos IMEIs antes de crear o reutilizar el equipo.</p></>}
      {step === 2 && resolution && (resolution.kind === 'NEW' ? <><p className="muted">Equipo externo nuevo · propietario {client.firstName} {client.lastName}</p><EquipmentFields value={equipment} onChange={setEquipment} /></> : <div className="lookup-result"><strong>Equipo encontrado: {resolution.equipment?.code}</strong><p>{resolution.equipment?.brand} {resolution.equipment?.model}</p><p>Propietario: {resolution.equipment?.owner?.firstName} {resolution.equipment?.owner?.lastName}</p><StatusBadge status={resolution.equipment!.registrationStatus} />{resolution.requiresConfirmation && <label className="checkbox-label"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Confirmo asociar {resolution.additions.map(i => `IMEI ${i.slot}: ${i.value}`).join(', ')} a este mismo equipo.</label>}</div>)}
      {step === 3 && <><p className="muted">{client.firstName} {client.lastName} · {resolution?.equipment ? `${resolution.equipment.code} · ${resolution.equipment.brand} ${resolution.equipment.model}` : `${equipment.brand} ${equipment.model}`}</p><h3>Selecciona qué IMEI actualizar</h3>{isDualImei(imeis) && <button type="button" className="secondary-button" onClick={() => setSelected(imeis.map(imei => imei.value))}>Registrar ambos IMEI</button>}{imeis.map(imei => <label className="checkbox-label selection-row" key={imei.value}><input type="checkbox" checked={selected.includes(imei.value)} onChange={e => setSelected(values => e.target.checked ? [...values, imei.value] : values.filter(value => value !== imei.value))} /><span>IMEI {resolution?.equipment?.imeis.find(i => i.value === imei.value)?.slot ?? imei.slot}<strong className="imei-value">{imei.value}</strong><StatusBadge status={resolution?.equipment?.imeis.find(existing => existing.value === imei.value)?.registrationStatus ?? null} /></span></label>)}<RegistrationFields status={status} method={method} onStatus={setStatus} onMethod={setMethod} /><p className="form-hint">Sólo se actualizarán los IMEIs seleccionados. El resto conserva su estado.</p></>}
      <ErrorNotice message={submit.error} /><div className="form-actions">{step > 0 && <button type="button" className="secondary-button" onClick={() => setStep(value => value - 1)}>Atrás</button>}<button className="primary-button" disabled={step === 0 && lookup.loading}>{submit.busy ? 'Guardando...' : step === 3 ? 'Guardar registro' : 'Continuar'}</button></div>
    </fieldset></form></>;
}
