import { useState } from 'react';
import { useApi } from '../../app/ApiProvider';
import { useSubmit } from '../../hooks/useSubmit';
import { equipmentEditSchema } from '../../../shared/validation';
import type { Equipment, EquipmentInput } from '../../types/pos';
import { ErrorNotice } from '../../components/common';
export function EquipmentFields({ value, onChange }: { value: EquipmentInput; onChange: (value: EquipmentInput) => void }) {
  return <div className="form-grid"><label>Marca<input name="brand" required maxLength={100} value={value.brand} onChange={e => onChange({ ...value, brand: e.target.value })} /></label><label>Modelo<input name="model" required maxLength={100} value={value.model} onChange={e => onChange({ ...value, model: e.target.value })} /></label><label>Número de serie <span className="optional">opcional</span><input name="serialNumber" maxLength={100} value={value.serialNumber ?? ''} onChange={e => onChange({ ...value, serialNumber: e.target.value })} /></label></div>;
}
export function EquipmentForm({ equipment, onSaved, onCancel }: { equipment: Equipment; onSaved: () => void; onCancel: () => void }) {
  const { api } = useApi(); const submit = useSubmit(); const [value, setValue] = useState<EquipmentInput>({ brand: equipment.brand, model: equipment.model, serialNumber: equipment.serialNumber });
  return <form className="form-panel" onSubmit={async e => {
    e.preventDefault(); const result = await submit.run(() => api.patch<Equipment>(`/equipment/${equipment.id}`, equipmentEditSchema.parse({ ...value, serialNumber: value.serialNumber?.trim() || null }))); if (result) onSaved();
  }}><EquipmentFields value={value} onChange={setValue} /><p className="form-hint">El propietario, los códigos y los valores IMEI se conservan.</p><ErrorNotice message={submit.error} /><div className="form-actions"><button className="primary-button" disabled={submit.busy}>{submit.busy ? 'Guardando...' : 'Guardar equipo'}</button><button type="button" className="secondary-button" disabled={submit.busy} onClick={onCancel}>Cancelar</button></div></form>;
}
