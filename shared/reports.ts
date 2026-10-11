import { z } from 'zod';

export const reportTypes = ['general', 'sales', 'registrations', 'clients', 'equipment', 'users'] as const;
export type ReportType = typeof reportTypes[number];
export const presetLabels = { today: 'HOY', yesterday: 'AYER', last7: 'ÚLTIMOS 7 DÍAS', month: 'ESTE MES', previousMonth: 'MES ANTERIOR', year: 'ESTE AÑO', custom: 'PERSONALIZADO' };
export type DatePreset = keyof typeof presetLabels;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.getUTCFullYear()>0 && value!=='9999-12-31' && date.toISOString().slice(0, 10) === value;
}, 'FECHA INVÁLIDA.');
export function limaDay(now = new Date()) {
  return new Date(now.getTime() - 5 * 3600000).toISOString().slice(0, 10);
}
export function addDays(day: string, count: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + count * 86400000).toISOString().slice(0, 10);
}
export function presetRange(preset: DatePreset, now = new Date()) {
  const today = limaDay(now), month = today.slice(0, 7), year = today.slice(0, 4);
  switch (preset) {
    case 'today': return { from: today, to: today };
    case 'yesterday': return { from: addDays(today, -1), to: addDays(today, -1) };
    case 'last7': return { from: addDays(today, -6), to: today };
    case 'previousMonth': { const end = addDays(`${month}-01`, -1); return { from: `${end.slice(0, 7)}-01`, to: end }; }
    case 'year': return { from: `${year}-01-01`, to: today };
    default: return { from: `${month}-01`, to: today };
  }
}
export const reportQuerySchema = z.object({
  from: day.optional(), to: day.optional(),
  preset: z.enum(['today', 'yesterday', 'last7', 'month', 'previousMonth', 'year', 'custom']).default('month'),
  group: z.enum(['day', 'week', 'month']).default('day'),
  userId: z.uuid().optional(), operator: z.enum(['BITEL', 'CLARO', 'MOVISTAR', 'ENTEL']).optional(),
  status: z.enum(['BLOCKED', 'PENDING', 'REGISTERED']).optional(),
  paymentMethod: z.enum(['CASH', 'YAPE', 'PLIN', 'CARD', 'TRANSFER', 'OTHER']).optional(),
  brand: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict().superRefine((value, ctx) => {
  if (Boolean(value.from) !== Boolean(value.to) || (value.preset === 'custom' && !value.from)) ctx.addIssue({ code: 'custom', message: 'INDICA AMBAS FECHAS.' });
  if (value.from && value.to && (value.from > value.to || Date.parse(value.to) - Date.parse(value.from) > 731 * 86400000)) ctx.addIssue({ code: 'custom', message: 'PERIODO INVÁLIDO: MÁXIMO 732 DÍAS.' });
});
export type ReportFilter = z.infer<typeof reportQuerySchema> & { from: string; to: string; start: Date; end: Date };
export function parseReportFilter(raw: unknown, type: ReportType, now = new Date()): ReportFilter {
  const query = reportQuerySchema.parse(raw);
  const allowed: Record<ReportType, string[]> = {
    general: [], sales: ['userId', 'paymentMethod', 'brand'], registrations: ['userId', 'operator', 'status', 'brand'],
    clients: [], equipment: ['brand'], users: ['userId'],
  };
  for (const key of ['userId', 'paymentMethod', 'operator', 'status', 'brand'] as const) {
    if (query[key] !== undefined && !allowed[type].includes(key)) throw new z.ZodError([{ code: 'custom', path: [key], message: 'FILTRO NO APLICABLE A ESTE REPORTE.' }]);
  }
  const range = query.from && query.to ? { from: query.from, to: query.to } : presetRange(query.preset, now);
  return { ...query, ...range, start: new Date(`${range.from}T00:00:00-05:00`), end: new Date(`${addDays(range.to, 1)}T00:00:00-05:00`) };
}
export type ReportCell = string | number | null;
export type ReportRow = Record<string, ReportCell>;
export interface ReportTable { title: string; columns: { key: string; label: string; money?: boolean }[]; rows: ReportRow[] }
export interface ReportData {
  type: ReportType; period: { from: string; to: string; timezone: 'America/Lima' }; generatedAt: string;
  filters?: Record<string, string>;
  summary: ReportRow; labels: Record<string, string>; rows: ReportRow[]; columns: ReportTable['columns'];
  total: number; page: number; limit: number; tables: ReportTable[];
  series: ReportRow[]; evolution: ReportRow[];
}
export const reportLabels: Record<ReportType, string> = { general: 'GENERAL', sales: 'VENTAS', registrations: 'REGISTROS', clients: 'CLIENTES', equipment: 'EQUIPOS', users: 'TRABAJADORES' };
export const stateLabels = { BLOCKED: 'BLOQUEADO', PENDING: 'REGISTRO PENDIENTE', REGISTERED: 'REGISTRADO' };
export const reportPaymentLabels = { CASH: 'EFECTIVO', YAPE: 'YAPE', PLIN: 'PLIN', CARD: 'TARJETA', TRANSFER: 'TRANSFERENCIA', OTHER: 'OTROS' };
