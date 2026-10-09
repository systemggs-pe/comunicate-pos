import { useEffect, useRef, useState } from 'react';
import { useApi } from '../app/ApiProvider';
import { ApiError } from '../services/api';
import { dniSchema } from '../../shared/validation';
import type { DniLookupResponse } from '../../shared/dni';
import type { ClientFieldsValue } from '../features/clients/ClientFields';
import type { Client } from '../types/pos';

export function useDniLookup(value: ClientFieldsValue, onChange: (value: ClientFieldsValue) => void) {
  const { api } = useApi();
  const parsed = dniSchema.safeParse(value.dni), dni = parsed.success ? parsed.data : '';
  const [revision, setRevision] = useState(0), [manualDni, setManualDni] = useState('');
  const key = `${dni}:${revision}`;
  const [result, setResult] = useState<{ key: string; data: DniLookupResponse<Client> | null; error: ApiError | null }>({ key: '', data: null, error: null });
  const latest = useRef({ value, onChange });
  useEffect(() => { latest.current = { value, onChange }; }, [value, onChange]);
  useEffect(() => {
    if (!dni || manualDni === dni) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api.get<DniLookupResponse<Client>>(`/dni/${dni}`, controller.signal).then(data => {
        if (controller.signal.aborted) return;
        setResult({ key, data, error: null });
        if (data.source === 'EXTERNAL' && dniSchema.safeParse(latest.current.value.dni).data === dni) {
          const draft = latest.current.value;
          // No sobrescribir correcciones ya escritas mientras se consultaba.
          latest.current.onChange({ ...draft, firstName: draft.firstName || data.data.firstName, lastName: draft.lastName || data.data.lastName });
        }
      }).catch(error => {
        if (!controller.signal.aborted) setResult({ key, data: null, error: error instanceof ApiError ? error : new ApiError(0, 'DNI_PROVIDER_UNAVAILABLE', 'No pudimos consultar el DNI. Puedes ingresar los datos manualmente.') });
      });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [api, dni, key, manualDni]);
  const current = result.key === key, manual = !!dni && manualDni === dni;
  const data = current ? result.data : null;
  return {
    valid: !!dni, loading: !!dni && !manual && !current, data: manual ? null : data,
    localClient: !manual && data?.source === 'LOCAL' ? data.client : null,
    error: !manual && current ? result.error : null, manual,
    useManual: () => setManualDni(dni),
    retry: () => { setManualDni(''); setRevision(value => value + 1); },
  };
}
export type DniLookupState = ReturnType<typeof useDniLookup>;
