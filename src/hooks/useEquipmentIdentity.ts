import { useEffect, useState } from 'react';
import { useApi } from '../app/ApiProvider';
import { ApiError } from '../services/api';
import type { Equipment, ImeiInput } from '../types/pos';
export function useEquipmentIdentity(imeis:ImeiInput[]) {
  const {api}=useApi();const key=imeis.map(i=>i.value.replace(/\s/g,'')).join(':');
  const values=key.split(':').filter(value=>/^\d{15}$/.test(value));
  const [state,setState]=useState<{key:string;equipment:Equipment|null;error:string|null}>({key:'',equipment:null,error:null});
  useEffect(()=>{
    if(!key.split(':').some(value=>/^\d{15}$/.test(value)))return;
    const controller=new AbortController();const timer=setTimeout(()=>{
      Promise.all(key.split(':').filter(value=>/^\d{15}$/.test(value)).map(value=>api.get<Equipment>(`/equipment/by-imei/${value}`,controller.signal).catch(error=>{if(error instanceof ApiError&&error.status===404)return null;throw error;}))).then(rows=>{
        if(controller.signal.aborted)return;
        const found=rows.filter((row):row is Equipment=>!!row);
        setState({key,equipment:new Set(found.map(row=>row.id)).size===1?found[0]:null,error:new Set(found.map(row=>row.id)).size>1?'Los IMEIs pertenecen a equipos distintos. Corrige la selección.':null});
      }).catch(()=>{if(!controller.signal.aborted)setState({key,equipment:null,error:'No pudimos buscar el equipo. Reintenta antes de confirmar.'});});
    },250);return()=>{clearTimeout(timer);controller.abort();};
  },[api,key]);
  return {equipment:state.key===key?state.equipment:null,error:state.key===key?state.error:null,loading:values.length>0&&state.key!==key};
}
