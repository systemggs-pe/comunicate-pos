import { Can } from '../app/AuthProvider';
import { MonitorSmartphone, UserRoundPlus } from 'lucide-react';
import { Link } from '../app/router';
import { PageHeading } from '../components/common';
import { ErrorNotice, Loading } from '../components/common';
import { useApiQuery } from '../hooks/useApiQuery';
import { money } from '../features/sales/common';
export function HomePage() {
  const query = useApiQuery<{ day: string; salesToday: number; revenueToday: string; equipmentSoldToday: number }>('/dashboard');
  return <><PageHeading title="Registro de equipos" description="Encuentra un IMEI o inicia un registro para su propietario." /><section className="dashboard-section"><div className="section-heading"><h2>Ventas de hoy</h2><Can permission="sales.create"><Link className="primary-button" to="/ventas/nueva">Nueva venta</Link></Can></div>{query.loading && <Loading />}<ErrorNotice message={query.error?.message} retry={query.refresh} />{query.data && <><p className="form-hint">{query.data.day} · Hora de Lima · ventas completadas</p><dl className="dashboard-stats"><div><dt>Ventas hoy</dt><dd>{query.data.salesToday}</dd></div><div><dt>Total vendido hoy</dt><dd>{money(query.data.revenueToday)}</dd></div><div><dt>Equipos vendidos hoy</dt><dd>{query.data.equipmentSoldToday}</dd></div></dl></>}</section><section className="home-workspace"><div><MonitorSmartphone size={32} aria-hidden="true" /><h2>Un equipo, un historial</h2><p>Busca primero los IMEIs para continuar sobre el dispositivo correcto. Puedes registrar uno hoy y el segundo después.</p><Can permission="registration.create"><Link className="primary-button" to="/registros/nuevo">Iniciar nuevo registro</Link></Can></div><div className="home-client-action"><UserRoundPlus size={24} aria-hidden="true" /><h2>Clientes</h2><p>Busca por DNI o nombre y consulta sus equipos.</p><Can permission="clients.read"><Link className="inline-link" to="/clientes">Ver clientes</Link></Can></div></section></>;
}
