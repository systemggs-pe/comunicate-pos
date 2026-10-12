import { lazy, Suspense, useState, useSyncExternalStore } from 'react';
import { useAuth } from '../../app/AuthProvider';
import { navigate, Link } from '../../app/router';
import { useApiQuery } from '../../hooks/useApiQuery';
import { ErrorNotice, Loading } from '../../components/common';
import { money } from '../sales/common';
import {apiUrl} from '../../services/api';
import { presetLabels, presetRange, reportLabels, reportTypes, stateLabels, reportPaymentLabels, type DatePreset, type ReportData, type ReportRow, type ReportTable, type ReportType } from '../../../shared/reports';
const SalesChart = lazy(() => import('./Charts').then(m => ({ default: m.SalesChart })));
const StateChart = lazy(() => import('./Charts').then(m => ({ default: m.StateChart })));
const EvolutionChart = lazy(() => import('./Charts').then(m => ({ default: m.EvolutionChart })));
function subscribe(callback: () => void) {
  window.addEventListener('popstate', callback); window.addEventListener('pos:navigate', callback);
  return () => { window.removeEventListener('popstate', callback); window.removeEventListener('pos:navigate', callback); };
}
function valueText(key: string, value: ReportRow[string]) {
  if (value == null) return '—';
  if (key === 'status') return stateLabels[value as keyof typeof stateLabels] ?? (value === 'ACTIVE' ? 'ACTIVO' : 'DESACTIVADO');
  if (key === 'payment') return reportPaymentLabels[value as keyof typeof reportPaymentLabels];
  if (key === 'origin') return value === 'STORE' ? 'COMUNIC@TE' : 'EXTERNO';
  if (key === 'sold') return value === 'true' ? 'SÍ' : 'NO';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short', hour12: false }).format(new Date(value));
  return String(value).toLocaleUpperCase('es-PE');
}
function Table({ table, type }: { table: ReportTable; type?: ReportType }) {
  const { can } = useAuth();
  return <section className="report-panel"><h2>{table.title}</h2>{table.rows.length ? <div className="report-table-scroll" tabIndex={0} aria-label={table.title}><table><thead><tr>{table.columns.map(c => <th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{table.rows.map((row, index) => <tr key={String(row.id ?? row.name ?? index)}>{table.columns.map(c => <td key={c.key}>{c.key === 'code' && type === 'clients' && can('clients.read') ? <Link className="inline-link" to={`/clientes/${row.id}`}>{row.code}</Link> : c.money ? money(String(row[c.key] ?? '0.00')) : valueText(c.key, row[c.key])}</td>)}</tr>)}</tbody></table></div> : <p className="report-empty">SIN DATOS PARA LOS FILTROS SELECCIONADOS.</p>}</section>;
}
export function Analytics({ dashboard = false }: { dashboard?: boolean }) {
  const search = useSyncExternalStore(subscribe, () => window.location.search, () => '');
  const params = new URLSearchParams(search);
  const requested = params.get('type');
  const type: ReportType = dashboard ? 'general' : reportTypes.includes(requested as ReportType) ? requested as ReportType : 'general';
  const preset = (params.get('preset') ?? 'month') as DatePreset;
  const range = presetRange(preset);
  const [metric, setMetric] = useState<'count' | 'amount'>('count');
  const [workerSearch, setWorkerSearch] = useState('');
  const [workerPage, setWorkerPage] = useState(1);
  const [exportState, setExportState] = useState({ busy: false, error: '' });
  const { can } = useAuth();
  const apiParams = new URLSearchParams(params); apiParams.delete('type');
  const query = useApiQuery<ReportData>(can('reports.read') ? `/${dashboard ? 'dashboard/summary' : `reports/${type}`}?${apiParams}` : null);
  const userQuery = useApiQuery<{ rows: ReportRow[]; total: number }>(can('reports.read') && ['sales', 'registrations', 'users'].includes(type) ? `/reports/actors?q=${encodeURIComponent(workerSearch)}&page=${workerPage}` : null);
  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    if (key === 'preset') { if (value !== 'custom') { next.delete('from'); next.delete('to'); } else { const initial = presetRange(preset); next.set('from', params.get('from') ?? initial.from); next.set('to', params.get('to') ?? initial.to); } }
    if (key === 'type') for (const filter of ['userId', 'operator', 'status', 'paymentMethod', 'brand']) next.delete(filter);
    navigate(`${dashboard ? window.location.pathname : '/reportes'}?${next}`);
  }
  async function download() {
    setExportState({ busy: true, error: '' });
    try {
      const response = await fetch(apiUrl(`/reports/export?type=${type}&${apiParams}`), { credentials: 'include', signal: AbortSignal.timeout(30000) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error?.message ?? 'NO SE PUDO EXPORTAR.'); }
      const blob = await response.blob(), url = URL.createObjectURL(blob), anchor = document.createElement('a');
      anchor.href = url; anchor.download = `COMUNICATE-${type}-${query.data?.period.from}-${query.data?.period.to}.csv`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); setExportState({ busy: false, error: '' });
    } catch (error) { setExportState({ busy: false, error: error instanceof Error ? error.message : 'NO SE PUDO EXPORTAR.' }); }
  }
  if (!can('reports.read')) return <p className="form-hint">EL RESUMEN FINANCIERO REQUIERE PERMISO DE REPORTES.</p>;
  const data = query.data;
  return <div className="analytics-workspace">
    {!dashboard && <nav className="report-tabs" aria-label="TIPO DE REPORTE">{reportTypes.map(item => <button key={item} aria-pressed={type === item} onClick={() => update('type', item)}>{reportLabels[item]}</button>)}</nav>}
    <section className="report-panel report-filters" aria-label="FILTROS DE REPORTES">
      <label>PERIODO<select aria-label="PERIODO" value={preset} onChange={e => update('preset', e.target.value)}>{Object.entries(presetLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      {preset === 'custom' && <><label>FECHA INICIAL<input type="date" value={params.get('from') ?? range.from} onChange={e => { const next = new URLSearchParams(params); next.set('from', e.target.value); if (!next.has('to')) next.set('to', range.to); next.delete('page'); navigate(`${window.location.pathname}?${next}`); }} /></label><label>FECHA FINAL<input type="date" value={params.get('to') ?? range.to} onChange={e => { const next = new URLSearchParams(params); next.set('to', e.target.value); if (!next.has('from')) next.set('from', range.from); next.delete('page'); navigate(`${window.location.pathname}?${next}`); }} /></label></>}
      {['general', 'sales', 'registrations'].includes(type) && <label>AGRUPACIÓN<select aria-label="AGRUPACIÓN" value={params.get('group') ?? 'day'} onChange={e => update('group', e.target.value)}><option value="day">DÍA</option><option value="week">SEMANA</option><option value="month">MES</option></select></label>}
      {['sales', 'registrations', 'users'].includes(type) && <label>TRABAJADOR<select aria-label="TRABAJADOR" value={params.get('userId') ?? ''} onChange={e => update('userId', e.target.value)}><option value="">TODOS</option>{params.get('userId') && !userQuery.data?.rows.some(row => row.id === params.get('userId')) && <option value={params.get('userId')!}>TRABAJADOR SELECCIONADO</option>}{userQuery.data?.rows.map(row => <option key={String(row.id)} value={String(row.id)}>{row.name} · {row.status === 'DISABLED' ? 'DESACTIVADO' : 'ACTIVO'}</option>)}</select></label>}
      {['sales', 'registrations', 'users'].includes(type) && <label>BUSCAR TRABAJADOR<input placeholder="NOMBRE · INCLUYE DESACTIVADOS" defaultValue={workerSearch} maxLength={100} onBlur={e => { setWorkerSearch(e.target.value.trim()); setWorkerPage(1); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></label>}
      {userQuery.data && userQuery.data.total > 100 && <div><button disabled={workerPage === 1} onClick={() => setWorkerPage(v => v - 1)}>ANTERIORES TRABAJADORES</button><button disabled={workerPage * 100 >= userQuery.data.total} onClick={() => setWorkerPage(v => v + 1)}>MÁS TRABAJADORES</button></div>}
      <ErrorNotice message={userQuery.error?.message} retry={userQuery.refresh} />
      {type === 'registrations' && <><label>OPERADOR<select aria-label="OPERADOR" value={params.get('operator') ?? ''} onChange={e => update('operator', e.target.value)}><option value="">TODOS</option>{['BITEL', 'CLARO', 'MOVISTAR', 'ENTEL'].map(name => <option key={name}>{name}</option>)}</select></label><label>ESTADO<select aria-label="ESTADO" value={params.get('status') ?? ''} onChange={e => update('status', e.target.value)}><option value="">TODOS</option>{Object.entries(stateLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></>}
      {type === 'sales' && <label>MÉTODO DE PAGO<select aria-label="MÉTODO DE PAGO" value={params.get('paymentMethod') ?? ''} onChange={e => update('paymentMethod', e.target.value)}><option value="">TODOS</option>{Object.entries(reportPaymentLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
      {['sales', 'registrations', 'equipment'].includes(type) && <label>MARCA<input aria-label="MARCA DEL REPORTE" key={`${type}:${params.get('brand')}`} defaultValue={params.get('brand') ?? ''} placeholder="TODAS" maxLength={100} onBlur={e => { if (e.target.value.trim() !== (params.get('brand') ?? '')) update('brand', e.target.value.trim()); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></label>}
      <button className="secondary-button" onClick={query.refresh}>ACTUALIZAR DATOS</button>
      {!dashboard && can('reports.export') && <button className="primary-button" onClick={() => void download()} disabled={exportState.busy || !data}>{exportState.busy ? 'EXPORTANDO…' : 'EXPORTAR CSV'}</button>}
    </section>
    <ErrorNotice message={query.error?.message} retry={query.refresh} /><ErrorNotice message={exportState.error} />{query.loading && <Loading />}
    {data && <><p className="report-period">{data.period.from} → {data.period.to} · AMERICA/LIMA · FECHA FINAL INCLUIDA</p>
      <dl className="report-stats">{Object.entries(data.summary).map(([key, value]) => <div key={key} data-testid={`metric-${key}`}><dt>{data.labels[key]}</dt><dd>{key.endsWith('Revenue') || key.endsWith('Amount') ? money(String(value)) : value}</dd></div>)}</dl>
      <p className="form-hint">IMPORTES DE SERVICIOS REGISTRADOS; NO CONFIRMAN PAGOS COBRADOS. VENTAS Y ATENCIONES: FECHA DE NEGOCIO. NUEVOS CLIENTES Y EQUIPOS: FECHA DE CREACIÓN.</p>
      <div className="report-chart-grid"><Suspense fallback={<Loading />}>
        {['general', 'sales'].includes(type) && <section className="report-panel"><h2>VENTAS POR PERIODO</h2><label>MÉTRICA<select aria-label="MÉTRICA" value={metric} onChange={e => setMetric(e.target.value as 'count' | 'amount')}><option value="count">CANTIDAD DE VENTAS</option><option value="amount">IMPORTE TOTAL VENDIDO</option></select></label><SalesChart rows={data.series} metric={metric} /></section>}
        {data.tables.find(t => t.title === 'ESTADO ACTUAL DE REGISTROS') && <section className="report-panel"><h2>DISTRIBUCIÓN DE REGISTROS</h2><StateChart table={data.tables.find(t => t.title === 'ESTADO ACTUAL DE REGISTROS')!} /></section>}
        {['general', 'registrations'].includes(type) && <section className="report-panel"><h2>EVOLUCIÓN DE REGISTROS</h2><p className="form-hint">CREADAS: FECHA DE CREACIÓN. FINALIZADAS: FECHA REAL DE FINALIZACIÓN. PENDIENTES: ESTADO ACTUAL DE LA COHORTE CREADA; NO REPRESENTA EL SALDO HISTÓRICO.</p><EvolutionChart rows={data.evolution} /></section>}
      </Suspense></div>
      {data.columns.length > 0 && <><Table type={type} table={{ title: reportLabels[type], columns: data.columns, rows: data.rows }} /><div className="report-pagination"><button disabled={data.page === 1} onClick={() => update('page', String(data.page - 1))}>ANTERIOR</button><span>PÁGINA {data.page} · {data.total} RESULTADOS</span><button disabled={data.page * data.limit >= data.total} onClick={() => update('page', String(data.page + 1))}>SIGUIENTE</button></div></>}
      {data.tables.map(table => <Table key={table.title} table={table} />)}
    </>}
  </div>;
}
