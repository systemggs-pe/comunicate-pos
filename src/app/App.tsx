import { Home, Users, MonitorSmartphone, Plus, ShoppingBag } from 'lucide-react';
import { ApiProvider, useApi } from './ApiProvider';
import { Link, usePathname } from './router';
import { TemporaryAccess } from '../features/auth/TemporaryAccess';
import { GlobalImeiSearch } from '../features/registrations/GlobalImeiSearch';
import { RegistrationFlow } from '../features/registrations/RegistrationFlow';
import { ClientsPage, ClientDetailsPage, NewClientPage } from '../pages/Clients';
import { EquipmentPage, EquipmentDetailsPage } from '../pages/Equipment';
import { SalesPage, SaleDetailsPage } from '../pages/Sales';
import { NewSale } from '../features/sales/NewSale';
import { HomePage } from '../pages/Home';
const navigation = [{ label: 'Inicio', path: '/', icon: Home }, { label: 'Clientes', path: '/clientes', icon: Users }, { label: 'Equipos', path: '/equipos', icon: MonitorSmartphone }, { label: 'Registros', path: '/registros/nuevo', icon: Plus }, { label: 'Ventas', path: '/ventas', icon: ShoppingBag }];
function Workspace() {
  const path = usePathname(); const { connected, disconnect } = useApi();
  const item = navigation.find(item => item.path === '/' ? path === '/' : path.startsWith(item.path));
  const clientId = path.match(/^\/clientes\/([^/]+)$/)?.[1], equipmentId = path.match(/^\/equipos\/([^/]+)$/)?.[1];
  const saleId = path.match(/^\/ventas\/([^/]+)$/)?.[1];
  const page = path === '/ventas' ? <SalesPage /> : path === '/ventas/nueva' ? <NewSale /> : saleId ? <SaleDetailsPage key={saleId} id={saleId} /> : path === '/' ? <HomePage /> : path === '/clientes' ? <ClientsPage /> : path === '/clientes/nuevo' ? <NewClientPage /> : clientId ? <ClientDetailsPage key={clientId} id={clientId} /> : path === '/equipos' ? <EquipmentPage /> : equipmentId ? <EquipmentDetailsPage key={equipmentId} id={equipmentId} /> : path === '/registros/nuevo' ? <RegistrationFlow /> : <p>Página no encontrada. <Link to="/">Ir al inicio</Link></p>;
  return <div className="app-shell"><aside className="sidebar"><Link className="brand" to="/">COMUNIC<span>@</span>TE <small>POS</small></Link><p className="nav-label">ESPACIO DE TRABAJO</p><nav aria-label="Navegación principal">{navigation.map(({ label, path: to, icon: Icon }) => <Link key={to} to={to} className={`nav-item ${item?.path === to ? 'selected' : ''}`} aria-current={item?.path === to ? 'page' : undefined}><Icon size={18} aria-hidden="true" /><span>{label}</span></Link>)}</nav><div className="sidebar-footer"><span className="tag">FASE 03</span><p>Cliente → Equipo<br />→ IMEI → Registro</p></div></aside><div className="main-panel"><header><span>COMUNIC@TE POS / <strong>{item?.label ?? 'Detalle'}</strong></span>{connected && <button className="text-button" onClick={disconnect}>Cerrar acceso</button>}</header><main>{connected ? <><GlobalImeiSearch key={`search:${path}`} /><div key={`page:${path}`}>{page}</div></> : <TemporaryAccess />}</main><footer>COMUNIC@TE POS<span>TEMPORARY AUTH · Fase 3</span></footer></div></div>;
}
export function App() { return <ApiProvider><Workspace /></ApiProvider>; }
