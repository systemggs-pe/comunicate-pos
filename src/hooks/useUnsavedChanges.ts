import { useEffect } from 'react';
export function useUnsavedChanges(dirty:boolean) {
  useEffect(()=>{
    if(!dirty)return;
    const before=(event:BeforeUnloadEvent)=>{event.preventDefault();};
    let completed=false;const saved=()=>{completed=true;};
    const navigation=(event:Event)=>{if(completed)return;if(!window.confirm('Hay cambios sin guardar. ¿Salir del formulario?'))event.preventDefault();};
    window.addEventListener('pos:form-saved',saved);window.addEventListener('beforeunload',before);window.addEventListener('pos:before-navigate',navigation);
    return()=>{window.removeEventListener('pos:form-saved',saved);window.removeEventListener('beforeunload',before);window.removeEventListener('pos:before-navigate',navigation);};
  },[dirty]);
}
