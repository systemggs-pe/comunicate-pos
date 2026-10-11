import { Prisma, type PrismaClient } from '@prisma/client';
import { parseReportFilter, reportLabels, reportPaymentLabels, stateLabels, type ReportData, type ReportRow, type ReportTable, type ReportType } from '../../shared/reports.js';
import { reportRepository as repo } from '../repositories/reports.repository.js';
import { DomainError } from '../lib/errors.js';
import { writeAudit, type AuditContext } from '../lib/audit.js';

const labels: Record<string, string> = {
  salesCount: 'VENTAS REALIZADAS', salesRevenue: 'INGRESOS DE VENTAS', equipmentSold: 'EQUIPOS VENDIDOS',
  registrationCount: 'REGISTROS IMEI', registrationAmount: 'IMPORTE REGISTRADO DE SERVICIOS', newClients: 'CLIENTES NUEVOS',
  equipmentCount: 'EQUIPOS CREADOS', externalEquipment: 'EQUIPOS EXTERNOS CREADOS', singleImei: 'EQUIPOS CON UN IMEI', doubleImei: 'EQUIPOS CON DOS IMEIS', imeiCount: 'IDENTIFICADORES IMEI',
  totalClients: 'TOTAL DE CLIENTES CONSERVADOS', buyingClients: 'CLIENTES CON COMPRAS', registrationClients: 'CLIENTES CON REGISTROS', repeatClients: 'CLIENTES CON MÁS DE UNA OPERACIÓN',
  requestsCreated: 'SOLICITUDES CREADAS', requestsCompleted: 'SOLICITUDES FINALIZADAS',
};
const column = (key: string, label: string, money = false) => ({ key, label, money });
const columns: Record<ReportType, ReportTable['columns']> = {
  general: [],
  sales: [column('code', 'VENTA'), column('date', 'FECHA DE VENTA'), column('worker', 'VENDEDOR'), column('payment', 'MÉTODO DE PAGO'), column('equipment', 'EQUIPOS'), column('amount', 'TOTAL', true)],
  registrations: [column('code', 'SOLICITUD'), column('date', 'FECHA DE ATENCIÓN'), column('equipment', 'EQUIPO'), column('operator', 'OPERADOR'), column('status', 'ESTADO ACTUAL'), column('amount', 'IMPORTE REGISTRADO', true), column('creator', 'CREADOR'), column('created', 'CREACIÓN'), column('completer', 'FINALIZADOR'), column('completed', 'FINALIZACIÓN')],
  clients: [column('code', 'CLIENTE'), column('name', 'NOMBRES'), column('date', 'CREACIÓN'), column('purchases', 'COMPRAS'), column('requests', 'SOLICITUDES')],
  equipment: [column('code', 'EQUIPO'), column('date', 'CREACIÓN'), column('brand', 'MARCA'), column('model', 'MODELO'), column('origin', 'ORIGEN'), column('imeis', 'IMEIS'), column('sold', 'VENTA VIGENTE')],
  users: [column('code', 'TRABAJADOR'), column('name', 'NOMBRE'), column('status', 'ESTADO'), column('sales', 'VENTAS'), column('amount', 'IMPORTE VENDIDO', true), column('created', 'SOLICITUDES CREADAS'), column('completed', 'SOLICITUDES FINALIZADAS'), column('serviceAmount', 'IMPORTE REGISTRADO DE SERVICIOS', true)],
};
export function displayReportCell(key: string, value: ReportRow[string]) {
  if (value === null) return '—';
  if (key === 'status') return stateLabels[value as keyof typeof stateLabels] ?? (value === 'ACTIVE' ? 'ACTIVO' : 'DESACTIVADO');
  if (key === 'payment') return reportPaymentLabels[value as keyof typeof reportPaymentLabels] ?? String(value);
  if (key === 'origin') return value === 'STORE' ? 'COMUNIC@TE' : 'EXTERNO';
  if (key === 'sold') return value === 'true' ? 'SÍ' : 'NO';
  if ((key === 'date' || key === 'created' || key === 'completed') && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short', hour12: false }).format(new Date(value));
  }
  return typeof value === 'string' ? value.toLocaleUpperCase('es-PE') : String(value);
}
export function csvCell(value: unknown) {
  let text = value == null ? '' : String(value);
  // Excel evaluates formulas even after whitespace/control characters. Quote alone is insufficient.
  const formulaText = Array.from(text).filter(char => char.charCodeAt(0) > 31).join('').trimStart();
  if (/^[=+\-@]/.test(formulaText) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function reportCsv(data: ReportData) {
  const lines: unknown[][] = [
    ['REPORTE', reportLabels[data.type]], ['PERIODO', data.period.from, data.period.to, 'AMERICA/LIMA'], ['GENERADO', data.generatedAt], [],
    ['FILTRO', 'VALOR'], ...Object.entries(data.filters ?? {}).map(([key, value]) => [key.toUpperCase(), value]), [],
    ['INDICADOR', 'TOTAL'], ...Object.entries(data.summary).map(([key, value]) => [data.labels[key] ?? key, value]), [],
  ];
  const tables = [...(data.columns.length ? [{ title: reportLabels[data.type], columns: data.columns, rows: data.rows }] : []), ...data.tables];
  if (data.series.length) tables.push({ title: 'VENTAS POR PERIODO', columns: [column('date', 'PERIODO'), column('count', 'VENTAS'), column('amount', 'IMPORTE', true)], rows: data.series });
  if (data.evolution.length) tables.push({ title: 'EVOLUCIÓN DE REGISTROS', columns: [column('date', 'PERIODO'), column('created', 'CREADAS'), column('completed', 'FINALIZADAS'), column('pending', 'ACTUALMENTE PENDIENTES DE LA COHORTE CREADA')], rows: data.evolution });
  for (const table of tables) {
    lines.push([table.title], table.columns.map(c => c.label), ...table.rows.map(row => table.columns.map(c => displayReportCell(c.key, row[c.key]))), []);
  }
  return '\ufeff' + lines.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
export function createReportsService(db: PrismaClient, ctx: AuditContext = {}) {
  async function read(type: ReportType, raw: unknown, exporting = false): Promise<ReportData> {
    const f = parseReportFilter(raw, type);
    return db.$transaction(async tx => {
      const summary = await repo.summary(tx, f, type);
      if (type === 'sales') for (const key of ['registrationCount', 'registrationAmount', 'newClients']) delete summary[key];
      if (type === 'registrations') for (const key of ['salesCount', 'salesRevenue', 'equipmentSold', 'newClients']) delete summary[key];
      const details = type === 'general' ? { rows: [], total: 0 } : await repo.details(tx, f, type, exporting ? 5001 : undefined);
      if (exporting && details.total > 5000) throw new DomainError(413, 'EXPORTACIÓN LIMITADA A 5,000 FILAS. REDUCE EL PERIODO O LOS FILTROS.', 'REPORT_EXPORT_LIMIT');
      const tables: ReportTable[] = [];
      if (type === 'general' || type === 'registrations') {
        const states = await repo.groups(tx, f, 'states'), operators = await repo.groups(tx, f, 'operators');
        tables.push({ title: 'ESTADO ACTUAL DE REGISTROS', columns: [column('name', 'ESTADO'), column('count', 'SOLICITUDES'), column('percent', 'PORCENTAJE')], rows: Object.entries(stateLabels).map(([key, name]) => ({ count: 0, percent: '0.00', ...states.find(r => r.name === key), name })) });
        tables.push({ title: 'REGISTROS POR OPERADOR', columns: [column('name', 'OPERADOR'), column('count', 'SOLICITUDES'), column('registered', 'REGISTRADAS'), column('pending', 'PENDIENTES'), column('blocked', 'BLOQUEADAS')], rows: ['BITEL', 'CLARO', 'MOVISTAR', 'ENTEL'].map(name => ({ name, count: 0, registered: 0, pending: 0, blocked: 0, ...operators.find(r => r.name === name) })) });
      }
      if (type === 'general' || type === 'sales') {
        const payments = await repo.groups(tx, f, 'payments');
        tables.push({ title: 'INGRESOS POR MÉTODO DE PAGO', columns: [column('name', 'MÉTODO'), column('count', 'VENTAS'), column('amount', 'IMPORTE', true), column('percent', '% DEL IMPORTE VENDIDO')], rows: Object.entries(reportPaymentLabels).map(([key, name]) => ({ count: 0, amount: '0.00', percent: '0.00', ...payments.find(r => r.name === key), name })) });
      }
      if (type === 'equipment') tables.push({ title: 'EQUIPOS POR MARCA', columns: [column('name', 'MARCA'), column('count', 'EQUIPOS')], rows: await repo.groups(tx, f, 'brands') });
      const series = type === 'general' || type === 'sales' ? await repo.salesSeries(tx, f) : [];
      const evolution = type === 'general' || type === 'registrations' ? await repo.evolution(tx, f) : [];
      const filters = Object.fromEntries(['userId', 'operator', 'status', 'paymentMethod', 'brand', 'group'].filter(key => f[key as keyof typeof f] !== undefined).map(key => [key, String(f[key as keyof typeof f])]));
      return { type, period: { from: f.from, to: f.to, timezone: 'America/Lima' }, generatedAt: new Date().toISOString(), filters, summary, labels, ...details, columns: columns[type], tables, series, evolution, page: f.page, limit: f.limit };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 20000 });
  }
  return {
    read,
    async export(type: ReportType, raw: unknown) {
      const data = await read(type, raw, true);
      const csv = reportCsv(data);
      if(Buffer.byteLength(csv,'utf8')>4*1024*1024)throw new DomainError(413,'EXPORTACIÓN DEMASIADO GRANDE. REDUCE EL PERIODO O LOS FILTROS.','REPORT_EXPORT_SIZE_LIMIT');
      await writeAudit(db, ctx, 'REPORT_EXPORTED', 'Report', undefined, { type, from: data.period.from, to: data.period.to, rowCount: data.total, generatedAt: data.generatedAt });
      return { filename: `COMUNICATE-${type}-${data.period.from}-${data.period.to}.csv`, csv };
    },
  };
}
