import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend } from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import type { ReportRow, ReportTable } from '../../../shared/reports';
import { money } from '../sales/common';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend);
const colors = ['#147d65', '#cd8a24', '#c05656'];
export function SalesChart({ rows, metric }: { rows: ReportRow[]; metric: 'count' | 'amount' }) {
  if (!rows.some(row => Number(row.count) > 0)) return <p className="report-empty">SIN VENTAS EN ESTE PERIODO.</p>;
  return <div className="report-chart"><Line aria-label="VENTAS POR PERIODO" role="img" data={{ labels: rows.map(r => String(r.date)), datasets: [{ label: metric === 'count' ? 'VENTAS' : 'IMPORTE VENDIDO (S/)', data: rows.map(r => Number(r[metric])), borderColor: colors[0], backgroundColor: colors[0], tension: 0.2 }] }} options={{ responsive: true, maintainAspectRatio: false, animation: false, scales: { y: { beginAtZero: true, ticks: { precision: metric === 'count' ? 0 : 2 } } }, plugins: { tooltip: { callbacks: { label: item => metric === 'amount' ? money(String(rows[item.dataIndex].amount)) : `${rows[item.dataIndex].count} VENTAS` } } } }} /></div>;
}
export function StateChart({ table }: { table: ReportTable }) {
  if (!table.rows.some(row => Number(row.count) > 0)) return <p className="report-empty">SIN SOLICITUDES EN ESTE PERIODO.</p>;
  return <div className="report-chart report-doughnut"><Doughnut role="img" aria-label="DISTRIBUCIÓN DE ESTADOS ACTUALES" data={{ labels: table.rows.map(r => String(r.name)), datasets: [{ data: table.rows.map(r => Number(r.count)), backgroundColor: colors }] }} options={{ responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { position: 'bottom' } } }} /></div>;
}
export function EvolutionChart({ rows }: { rows: ReportRow[] }) {
  if (!rows.length) return <p className="report-empty">SIN CREACIONES O FINALIZACIONES EN ESTE PERIODO.</p>;
  return <div className="report-chart"><Line role="img" aria-label="EVOLUCIÓN DE REGISTROS" data={{ labels: rows.map(r => String(r.date)), datasets: [['created', 'CREADAS'], ['completed', 'FINALIZADAS'], ['pending', 'ACTUALMENTE PENDIENTES DE LA COHORTE CREADA']].map(([key, label], i) => ({ label, data: rows.map(r => Number(r[key])), borderColor: colors[i], backgroundColor: colors[i], tension: 0.2 })) }} options={{ responsive: true, maintainAspectRatio: false, animation: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { position: 'bottom' } } }} /></div>;
}
