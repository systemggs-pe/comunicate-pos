import {useEffect,useRef,type ReactNode} from 'react';
import {X} from 'lucide-react';
export function ReferenceDialog({label,onClose,children,className=''}:{label:string;onClose:()=>void;children:ReactNode;className?:string}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const element=ref.current;element?.showModal();return()=>element?.close();},[]);
 return <dialog ref={ref} className={`reference-dialog ${className}`} aria-label={label} onCancel={e=>{e.preventDefault();onClose();}}><button className="icon-button reference-close" type="button" aria-label={`Cerrar ${label}`} onClick={onClose}><X size={19}/></button>{children}</dialog>;
}
