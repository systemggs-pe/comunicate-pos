import {useSubmit} from '../hooks/useSubmit';
import {BottomNavigation} from './BottomNavigation';
import '../design.css';
import { Home, Users, MonitorSmartphone, Plus, ShoppingBag,LogOut } from 'lucide-react';
import { useEffect,lazy,Suspense } from 'react';
import {RouteBoundary} from './RouteBoundary';
import { AuthProvider, useAuth } from './AuthProvider';
import { Loading,ErrorNotice } from '../components/common';
import type { PermissionKey } from '../../shared/auth';
import { Link, navigate, usePathname } from './router';
import { Login } from '../features/auth/Login';
import { GlobalImeiSearch } from '../features/registrations/GlobalImeiSearch';
const ReportsPage=lazy(()=>import('../pages/Reports').then(m=>({default:m.ReportsPage})));
const CompanySettingsPage=lazy(()=>import('../pages/CompanySettings').then(m=>({default:m.CompanySettingsPage})));
const SaleReceiptPreview=lazy(()=>import('../features/receipts/Receipt').then(m=>({default:m.SaleReceiptPreview})));
const OperationalRegistrationFlow=lazy(()=>import('../features/registrations/OperationalRegistrationFlow').then(m=>({default:m.OperationalRegistrationFlow})));
const RegistrationRequestsPage=lazy(()=>import('../pages/RegistrationRequests').then(m=>({default:m.RegistrationRequestsPage})));
const RegistrationRequestDetailsPage=lazy(()=>import('../pages/RegistrationRequests').then(m=>({default:m.RegistrationRequestDetailsPage})));
const UsersPage=lazy(()=>import('../pages/Users').then(m=>({default:m.UsersPage})));
const NewUserPage=lazy(()=>import('../pages/Users').then(m=>({default:m.NewUserPage})));
const UserDetailsPage=lazy(()=>import('../pages/Users').then(m=>({default:m.UserDetailsPage})));
const RolesPage=lazy(()=>import('../pages/Roles').then(m=>({default:m.RolesPage})));
const AuditPage=lazy(()=>import('../pages/Audit').then(m=>({default:m.AuditPage})));
const RegistrationFlow=lazy(()=>import('../features/registrations/RegistrationFlow').then(m=>({default:m.RegistrationFlow})));
const ClientsPage=lazy(()=>import('../pages/Clients').then(m=>({default:m.ClientsPage})));
const ClientDetailsPage=lazy(()=>import('../pages/Clients').then(m=>({default:m.ClientDetailsPage})));
const NewClientPage=lazy(()=>import('../pages/Clients').then(m=>({default:m.NewClientPage})));
const EquipmentPage=lazy(()=>import('../pages/Equipment').then(m=>({default:m.EquipmentPage})));
const EquipmentDetailsPage=lazy(()=>import('../pages/Equipment').then(m=>({default:m.EquipmentDetailsPage})));
const SalesPage=lazy(()=>import('../pages/Sales').then(m=>({default:m.SalesPage})));
const SaleDetailsPage=lazy(()=>import('../pages/Sales').then(m=>({default:m.SaleDetailsPage})));
const NewSale=lazy(()=>import('../features/sales/NewSale').then(m=>({default:m.NewSale})));
const PhotoDniPage=lazy(()=>import('../pages/PhotoDni').then(m=>({default:m.PhotoDniPage})));
const HomePage=lazy(()=>import('../pages/Home').then(m=>({default:m.HomePage})));
const navigation: {label:string;path:string;icon:typeof Home;permission:PermissionKey}[] = [
{label:'Foto DNI',path:'/foto-dni',icon:Users,permission:'client.documents.read'}, {label:'Configuración',path:'/configuracion',icon:ShoppingBag,permission:'settings.read'}, {label:'Inicio',path:'/',icon:Home,permission:'sales.read'}, {label:'Clientes',path:'/clientes',icon:Users,permission:'clients.read'}, {label:'Equipos',path:'/equipos',icon:MonitorSmartphone,permission:'equipment.read'}, {label:'Registros',path:'/registros',icon:Plus,permission:'registration.read'}, {label:'Ventas',path:'/ventas',icon:ShoppingBag,permission:'sales.read'}, {label:'REPORTES',path:'/reportes',icon:ShoppingBag,permission:'reports.read'}, {label:'Usuarios',path:'/usuarios',icon:Users,permission:'users.read'}, {label:'Roles',path:'/roles',icon:Users,permission:'roles.read'}, {label:'Auditoría',path:'/auditoria',icon:ShoppingBag,permission:'audit.read'}];
function pagePermission(path:string):PermissionKey|null {
if(path==='/foto-dni')return 'client.documents.read'; if(path==='/clientes/nuevo')return 'clients.create'; if(path==='/ventas/nueva')return 'sales.create'; if(path==='/usuarios/nuevo')return 'users.create';
if(path==='/registros/tecnico')return 'registration.update'; if(path==='/registros/nuevo')return 'registration.create'; if(path==='/'||path==='/dashboard')return 'sales.read';
return navigation.find(n=>n.path!=='/'&&path.startsWith(n.path))?.permission??null;
}
function Workspace() {
  const path = usePathname(); const { user,loading,error,refresh,can,logout } = useAuth(); const submit=useSubmit();
  useEffect(()=>{if(!loading&&!error&&!user&&path!=='/login')navigate('/login');if(!loading&&user&&path==='/login')navigate('/dashboard');},[loading,user,path,error]);
  if(loading)return <div className="login-shell"><Loading/></div>;
  if(error)return <div className="login-shell"><ErrorNotice message={error} retry={()=>void refresh()}/></div>;
  if(!user)return <Login/>;
  const item = navigation.find(item => item.path === '/' ? path === '/' || path === '/dashboard' : path.startsWith(item.path));
  const clientId = path.match(/^\/clientes\/([^/]+)$/)?.[1], equipmentId = path.match(/^\/equipos\/([^/]+)$/)?.[1];
  const requestId=path.match(/^\/registros\/([^/]+)$/)?.[1];
  const saleId = path.match(/^\/ventas\/([^/]+)$/)?.[1];
  const userId=path.match(/^\/usuarios\/([^/]+)$/)?.[1];
  const receiptId=path.match(/^\/ventas\/([^/]+)\/ticket$/)?.[1];
  if(receiptId)return can('sales.read')?<RouteBoundary key={path}><Suspense fallback={<Loading/>}><SaleReceiptPreview key={path+window.location.search} id={receiptId}/></Suspense></RouteBoundary>:<p>ACCESO RESTRINGIDO</p>;
  const page = path==='/foto-dni'?<PhotoDniPage/>:path==='/reportes'?<ReportsPage/>:(path==='/configuracion'||path==='/configuracion/empresa')?<CompanySettingsPage/>:path==='/usuarios'?<UsersPage/>:path==='/usuarios/nuevo'?<NewUserPage/>:userId?<UserDetailsPage key={userId} id={userId}/>:path==='/roles'?<RolesPage/>:path==='/auditoria'?<AuditPage/>:path === '/ventas' ? <SalesPage /> : path === '/ventas/nueva' ? <NewSale /> : saleId ? <SaleDetailsPage key={saleId} id={saleId} /> : (path === '/' || path === '/dashboard') ? <HomePage /> : path === '/clientes' ? <ClientsPage /> : path === '/clientes/nuevo' ? <NewClientPage /> : clientId ? <ClientDetailsPage key={clientId} id={clientId} /> : path === '/equipos' ? <EquipmentPage /> : equipmentId ? <EquipmentDetailsPage key={equipmentId} id={equipmentId} /> : path === '/registros/nuevo' ? <OperationalRegistrationFlow /> : path === '/registros/tecnico' ? <RegistrationFlow /> : path === '/registros' ? <RegistrationRequestsPage /> : requestId ? <RegistrationRequestDetailsPage key={requestId} id={requestId} /> : <p>Página no encontrada. <Link to="/">Ir al inicio</Link></p>;
  const title=path==='/registros/nuevo'?'Nuevo registro':item?.label??'Detalle';
  return <div className="app-shell design-shell"><div className="main-panel"><header className="workspace-header"><Link to="/" className="workspace-brand" aria-label="COMUNIC@TE POS"><span>CM</span><div><strong>{title}</strong><small>COMUNIC@TE · POS</small></div></Link>{can('equipment.read')&&<GlobalImeiSearch key={`search:${path}`} compact/>}<button type="button" className="icon-button" aria-label="Cerrar sesión" disabled={submit.busy} onClick={()=>void submit.run(logout)}><LogOut size={18}/></button></header><main><ErrorNotice message={submit.error}/><div key={`page:${path}`}>{pagePermission(path)&&!can(pagePermission(path)!)?<section className="form-panel" role="alert"><h1>Acceso restringido</h1><p>No tienes permisos para acceder a esta sección.</p></section>:<RouteBoundary key={path}><Suspense fallback={<Loading/>}>{page}</Suspense></RouteBoundary>}</div></main><BottomNavigation items={navigation}/></div></div>;

}
export function App() { return <AuthProvider><Workspace /></AuthProvider>; }
