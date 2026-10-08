import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useApi } from '../../app/ApiProvider';
import { Link } from '../../app/router';
import { useSubmit } from '../../hooks/useSubmit';
import { imeiValueSchema } from '../../../shared/validation';
import type { Equipment } from '../../types/pos';
import { ErrorNotice, StatusBadge } from '../../components/common';

export function GlobalImeiSearch() {
  const { api } = useApi(); const submit = useSubmit();
  const [value, setValue] = useState(''), [result, setResult] = useState<{ equipment: Equipment; value: string } | null>(null);
  useEffect(() => { const clear = () => setResult(null); window.addEventListener('pos:datachanged', clear); return () => window.removeEventListener('pos:datachanged', clear); }, []);
  const matched = result?.equipment.imeis.find(i => i.value === result.value);
  return <section className="global-search" aria-label="Búsqueda global por IMEI"><form onSubmit={async event => {
    event.preventDefault(); setResult(null);
    const found = await submit.run(async () => { const normalized = imeiValueSchema.parse(value); return { equipment: await api.get<Equipment>(`/equipment/by-imei/${normalized}`), value: normalized }; });
    if (found) setResult(found);
  }}><label htmlFor="global-imei">Buscar por IMEI</label><div className="search-control"><Search size={18} aria-hidden="true" /><input id="global-imei" inputMode="numeric" autoComplete="off" placeholder="15 dígitos" maxLength={24} value={value} onChange={e => { setValue(e.target.value); setResult(null); }} required /><button className="primary-button" disabled={submit.busy}>{submit.busy ? 'Buscando...' : 'Buscar IMEI'}</button></div></form><ErrorNotice message={submit.error} />{submit.code === 'IMEI_NOT_FOUND' && <Link className="inline-link" to="/registros/nuevo">Crear un nuevo registro</Link>}{result && matched && <div className="search-result" role="status"><div><strong>{result.equipment.brand} {result.equipment.model}</strong><p>{result.equipment.code} · {result.equipment.owner ? `${result.equipment.owner.firstName} ${result.equipment.owner.lastName}` : 'Sin propietario'}</p><p>IMEI {matched.slot}: <span className="numeric">{matched.value}</span></p><StatusBadge status={matched.registrationStatus} /></div><Link className="secondary-button" to={`/equipos/${result.equipment.id}`}>Ver equipo y registrar</Link></div>}</section>;
}
