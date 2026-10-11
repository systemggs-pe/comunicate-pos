import { Can } from '../app/AuthProvider';
import { MonitorSmartphone, UserRoundPlus } from 'lucide-react';
import { Link } from '../app/router';
import { PageHeading } from '../components/common';
import { Analytics } from '../features/reports/Analytics';


export function HomePage() {
  return <><PageHeading title="Registro de equipos" description="Encuentra un IMEI o inicia un registro para su propietario." /><Can permission="sales.create"><Link className="primary-button" to="/ventas/nueva">Nueva venta</Link></Can><Analytics dashboard /><section className="home-workspace"><div><MonitorSmartphone size={32} aria-hidden="true" /><h2>Un equipo, un historial</h2><p>Busca primero los IMEIs para continuar sobre el dispositivo correcto. Puedes registrar uno hoy y el segundo después.</p><Can permission="registration.create"><Link className="primary-button" to="/registros/nuevo">Iniciar nuevo registro</Link></Can></div><div className="home-client-action"><UserRoundPlus size={24} aria-hidden="true" /><h2>Clientes</h2><p>Busca por DNI o nombre y consulta sus equipos.</p><Can permission="clients.read"><Link className="inline-link" to="/clientes">Ver clientes</Link></Can></div></section></>;
}
