import {Home,ClipboardList,ShoppingCart,Users,Ellipsis,X} from 'lucide-react';
import {useRef,useState} from 'react';
import {useSubmit} from '../hooks/useSubmit';
import {ErrorNotice} from '../components/common';
import {useAuth} from './AuthProvider';
import {Link,usePathname} from './router';
import type {PermissionKey} from '../../shared/auth';
export function BottomNavigation({items}:{items:{label:string;path:string;permission:PermissionKey}[]}){
 const {can,user,logout}=useAuth(),submit=useSubmit(),path=usePathname(),dialog=useRef<HTMLDialogElement>(null),[open,setOpen]=useState(false);
 const main=[{label:'Inicio',path:'/',icon:Home,permission:'sales.read'},{label:'Registros',path:'/registros',icon:ClipboardList,permission:'registration.read'},{label:'Ventas',path:'/ventas',icon:ShoppingCart,permission:'sales.read'},{label:'Clientes',path:'/clientes',icon:Users,permission:'clients.read'}] as const;
 const extra=items.filter(i=>!main.some(m=>m.path===i.path));
 return <><nav className="bottom-navigation" aria-label="Navegación principal">{main.map(({label,path:to,icon:Icon,permission})=>can(permission)&&<Link key={to} to={to} aria-current={(to==='/'?(path==='/'||path==='/dashboard'):path.startsWith(to))?'page':undefined}><Icon size={21} aria-hidden="true"/><span>{label}</span></Link>)}<button type="button" aria-label="Más" aria-expanded={open} aria-controls="more-navigation" className={extra.some(i=>path.startsWith(i.path))?'selected':''} onClick={()=>{setOpen(true);dialog.current?.showModal();}}><Ellipsis size={21} aria-hidden="true"/><span>Más</span></button></nav><dialog ref={dialog} id="more-navigation" className="more-navigation" aria-label="Más módulos" onClose={()=>setOpen(false)}><div className="more-heading"><h2>Más</h2><button type="button" className="icon-button" aria-label="Cerrar menú" onClick={()=>dialog.current?.close()}><X size={20}/></button></div><p>{user?.name}<small>{user?.role.code}</small></p><nav aria-label="Módulos adicionales">{extra.filter(i=>can(i.permission)).map(i=><Link key={i.path} to={i.path} onClick={()=>dialog.current?.close()}>{i.label}</Link>)}</nav><button className="secondary-button" type="button" disabled={submit.busy} onClick={()=>void submit.run(logout)}>Cerrar sesión</button><ErrorNotice message={submit.error}/></dialog></>;
}
