import {useEffect,useRef,useState} from 'react';
import {useApi} from '../../app/ApiProvider';
import {useSubmit} from '../../hooks/useSubmit';
import {ErrorNotice} from '../../components/common';
import type {RegistrationRequest} from '../../types/pos';

export function UnblockRequestDialog({request,onClose,onCompleted}:{request:RegistrationRequest;onClose:()=>void;onCompleted:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),form=useRef<HTMLFormElement>(null),{api}=useApi(),submit=useSubmit(form);
 const [reason,setReason]=useState(''),[confirm,setConfirm]=useState(false);
 useEffect(()=>{if(!dialog.current?.open)dialog.current?.showModal();},[]);
 return <dialog ref={dialog} className="delete-dialog unblock-dialog" aria-label="Desbloquear registro" onClose={onClose} onCancel={e=>{if(submit.busy)e.preventDefault();}}>
  <h2>Confirmar desbloqueo</h2>
  <p><strong>{request.code}</strong> · IMEI {request.imei?.value}</p>
  <p>Se marcará este IMEI como registrado y se conservará su historial. Los otros IMEIs del equipo conservarán su estado.</p>
  <p className="form-hint">Confirma sólo después de completar el trámite externo. Esta acción actualiza el sistema; no realiza el desbloqueo ante el operador.</p>
  <form ref={form} onSubmit={async e=>{e.preventDefault();if(!confirm||!reason.trim())return;const result=await submit.run(()=>api.post(`/registration-requests/${request.id}/transition`,{action:'UNBLOCK',confirm,reason:reason.trim()}));if(result){onCompleted();dialog.current?.close();}}}>
   <fieldset disabled={submit.busy}>
    <label>Motivo<textarea required maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>
    <label className="checkbox-label"><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/>Confirmo el desbloqueo de este IMEI</label>
    <ErrorNotice message={submit.error}/>
    <div className="form-actions"><button type="button" className="secondary-button" onClick={()=>dialog.current?.close()}>Cancelar</button><button className="primary-button" disabled={!confirm||!reason.trim()||submit.busy}>{submit.busy?'Procesando...':'Confirmar desbloqueo'}</button></div>
   </fieldset>
  </form>
 </dialog>;
}
