import type { ClientInput } from '../../types/pos';
export interface ClientFieldsValue { dni: string; firstName: string; lastName: string; phone: string; email: string }
export const emptyClient: ClientFieldsValue = { dni: '', firstName: '', lastName: '', phone: '', email: '' };
export function asClientInput(value: ClientFieldsValue): ClientInput { return { dni: value.dni, firstName: value.firstName, lastName: value.lastName, phone: value.phone.trim() || undefined, email: value.email.trim() || undefined }; }
export function ClientFields({ value, onChange, showDni = true, readOnlyDni = false }: { value: ClientFieldsValue; onChange: (value: ClientFieldsValue) => void; showDni?: boolean; readOnlyDni?: boolean }) {
  return <div className="form-grid">
    {showDni && <label>DNI<input name="dni" inputMode="numeric" autoComplete="off" maxLength={12} required readOnly={readOnlyDni} value={value.dni} onChange={e => onChange({ ...value, dni: e.target.value })} /><span className="form-hint">8 dígitos{readOnlyDni ? ', no editable' : ''}.</span></label>}
    <label>Nombres<input name="firstName" autoComplete="given-name" maxLength={100} required value={value.firstName} onChange={e => onChange({ ...value, firstName: e.target.value })} /></label>
    <label>Apellidos<input name="lastName" autoComplete="family-name" maxLength={100} required value={value.lastName} onChange={e => onChange({ ...value, lastName: e.target.value })} /></label>
    <label>Celular <span className="optional">opcional</span><input name="phone" type="tel" autoComplete="tel" maxLength={30} value={value.phone} onChange={e => onChange({ ...value, phone: e.target.value })} /></label>
    <label>Correo <span className="optional">opcional</span><input name="email" type="email" autoComplete="email" maxLength={254} value={value.email} onChange={e => onChange({ ...value, email: e.target.value })} /></label>
  </div>;
}
