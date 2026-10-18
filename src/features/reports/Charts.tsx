import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { ReportRow, ReportTable } from '../../../shared/reports';
import { money } from '../sales/common';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);
const colors = ['#096acb', '#008567', '#b7791f'];
export function SalesChart({ rows, metric }: { rows: ReportRow[]; metric: 'count' | 'amount' }) {
  if (!rows.some(row => Number(row.count) > 0)) return <p className="report-empty">No hay ventas en este periodo.</p>;
  return <div className="report-chart"><Line aria-label="VENTAS POR PERIODO" role="img" data={{ labels: rows.map(r => String(r.date)), datasets: [{ label: metric === 'count' ? 'VENTAS' : 'IMPORTE VENDIDO (S/)', data: rows.map(r => Number(r[metric])), borderColor: colors[0], backgroundColor: colors[0], pointRadius:rows.length>80?1:3, pointHoverRadius:5, borderWidth:2, tension: 0.2 }] }} options={{ responsive: true, maintainAspectRatio: false, animation: false, scales: { x:{grid:{display:false},ticks:{maxTicksLimit:6,maxRotation:0}},y: { beginAtZero: true, ticks: { precision: metric === 'count' ? 0 : 2 } } }, plugins: { legend:{display:false},tooltip: { callbacks: { label: item => metric === 'amount' ? money(String(rows[item.dataIndex].amount)) : `${rows[item.dataIndex].count} VENTAS` } } } }} /></div>;
}
export function StateChart({ table }: { table: ReportTable }) {
  if (!table.rows.some(row => Number(row.count) > 0)) return <p className="report-empty">No hay registros en este periodo.</p>;
  return <dl className="report-state-list">{table.rows.map(row=>{
    const name=String(row.name),count=Number(row.count),percent=Math.max(0,Math.min(100,Number(row.percent)||0));
    const label=name==='BLOQUEADO'?'Bloqueados':name==='REGISTRADO'?'Registrados':'Pendientes';
    return <div key={name} className={name==='BLOQUEADO'?'is-blocked':name==='REGISTRADO'?'is-registered':'is-pending'}><dt>{label}</dt><dd><strong>{count}</strong><span>{percent.toLocaleString('es-PE',{maximumFractionDigits:1})}%</span></dd><div className="report-state-track" aria-hidden="true"><span style={{width:`${percent}%`}}/></div></div>;
  })}</dl>;
}
export function EvolutionChart({ rows }: { rows: ReportRow[] }) {
  if (!rows.length) return <p className="report-empty">No hay movimientos en este periodo.</p>;
  return <div className="report-chart"><Line role="img" aria-label="EVOLUCIÓN DE REGISTROS" data={{ labels: rows.map(r => String(r.date)), datasets: [['created', 'Creados'], ['completed', 'Completados'], ['pending', 'Siguen pendientes']].map(([key, label], i) => ({ label, data: rows.map(r => Number(r[key])), borderColor: colors[i], backgroundColor: colors[i], tension: 0.2 })) }} options={{ responsive: true, maintainAspectRatio: false, animation: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { position: 'bottom' } } }} /></div>;
}
