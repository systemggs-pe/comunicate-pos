import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  const versions=useRef<Partial<Record<keyof ClientFieldsValue,number>>>({});
  useLayoutEffect(()=>{if(latest.current.value.dni!==value.dni)versions.current={};else for(const field of ['firstName','lastName','fullName','phone','email','address','department','province'] as const)if(latest.current.value[field]!==value[field])versions.current[field]=(versions.current[field]??0)+1;latest.current={value,onChange};});
  useEffect(() => {
    if (!dni || manualDni === dni) return;
    const controller = new AbortController(),baseline={...versions.current};
    const timer = setTimeout(() => {
      api.get<DniLookupResponse<Client>>(`/dni/${dni}`, controller.signal).then(data => {
        if (controller.signal.aborted) return;
        setResult({ key, data, error: null });
        if((data.source==='LOCAL'||data.source==='EXTERNAL')&&dniSchema.safeParse(latest.current.value.dni).data===dni){
          const draft=latest.current.value,incoming=data.source==='LOCAL'?data.client:data.data;
          const next={...draft};
          const nameFields=['firstName','lastName','fullName'] as const;
          const nameDirty=nameFields.some(field=>(versions.current[field]??0)!==(baseline[field]??0));
          for(const field of ['firstName','lastName','fullName','phone','email','address','department','province'] as const){
            if(nameFields.some(f=>f===field)&&(nameDirty||draft.firstName||draft.lastName||draft.fullName))continue;
            if(!draft[field]&&(versions.current[field]??0)===(baseline[field]??0)&&field in incoming){const v=(incoming as Partial<ClientFieldsValue>)[field];if(v)next[field]=v;}
          }
          latest.current.onChange(next);
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
