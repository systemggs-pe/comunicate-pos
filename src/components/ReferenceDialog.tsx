import {useEffect,useRef,type ReactNode} from 'react';
import {X} from 'lucide-react';
export function ReferenceDialog({label,onClose,children,className='',mobile='sheet',closeLabel=`Cerrar ${label}`}:{label:string;onClose:()=>void;children:ReactNode;className?:string;mobile?:'sheet'|'full';closeLabel?:string}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const element=ref.current;element?.showModal();return()=>element?.close();},[]);
 return <dialog ref={ref} className={`reference-dialog ${className}`} data-mobile-dialog={mobile} aria-label={label} onCancel={e=>{e.preventDefault();onClose();}}><button className="icon-button reference-close" type="button" aria-label={closeLabel} onClick={onClose}><X size={19}/></button>{children}</dialog>;
}
