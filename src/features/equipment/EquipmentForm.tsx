import { ValidatedInput } from '../../components/FormValidation';
import { useState } from 'react';
import { useApi } from '../../app/ApiProvider';
import { useSubmit } from '../../hooks/useSubmit';
import { equipmentEditSchema } from '../../../shared/validation';
import type { Equipment, EquipmentInput } from '../../types/pos';
import { ErrorNotice } from '../../components/common';
export function EquipmentFields({ value, onChange, commercialRequired=false }: { value: EquipmentInput; onChange: (value: EquipmentInput) => void; commercialRequired?:boolean }) {
  return <div className="form-grid"><label>Nombre comercial<ValidatedInput aria-label="Nombre comercial" name="commercialName" required={commercialRequired} maxLength={100} value={value.commercialName ?? ''} onChange={e => onChange({...value, commercialName:e.target.value || null})} /></label><label>Marca<ValidatedInput aria-label="Marca" name="brand" required maxLength={100} value={value.brand} onChange={e => onChange({ ...value, brand: e.target.value })} /></label><label>Modelo<ValidatedInput aria-label="Modelo" name="model" required maxLength={100} value={value.model} onChange={e => onChange({ ...value, model: e.target.value })} /></label><label>Número de serie <span className="optional">opcional</span><ValidatedInput aria-label="Número de serie" name="serialNumber" maxLength={100} value={value.serialNumber ?? ''} onChange={e => onChange({ ...value, serialNumber: e.target.value })} /></label>{(['color','ram','storage'] as const).map((field,index)=><label key={field}>{['Color','RAM','Almacenamiento / ROM'][index]}<ValidatedInput aria-label={['Color','RAM','Almacenamiento / ROM'][index]} name={field} maxLength={100} value={value[field]??''} onChange={e=>onChange({...value,[field]:e.target.value||null})} /></label>)}</div>;
}
export function EquipmentForm({ equipment, onSaved, onCancel }: { equipment: Equipment; onSaved: () => void; onCancel: () => void }) {
  const { api } = useApi(); const submit = useSubmit(); const [value, setValue] = useState<EquipmentInput>({ brand: equipment.brand, model: equipment.model, serialNumber: equipment.serialNumber, commercialName:equipment.commercialName, color:equipment.color, ram:equipment.ram, storage:equipment.storage });
  return <form className="form-panel" onSubmit={async e => {
    e.preventDefault(); const result = await submit.run(() => api.patch<Equipment>(`/equipment/${equipment.id}`, equipmentEditSchema.parse({ ...value, serialNumber: value.serialNumber?.trim() || null }))); if (result) onSaved();
  }}><EquipmentFields value={value} onChange={setValue} /><p className="form-hint">El propietario, los códigos y los valores IMEI se conservan.</p><ErrorNotice message={submit.error} /><div className="form-actions"><button className="primary-button" disabled={submit.busy}>{submit.busy ? 'Guardando...' : 'Guardar equipo'}</button><button type="button" className="secondary-button" disabled={submit.busy} onClick={onCancel}>Cancelar</button></div></form>;
}
