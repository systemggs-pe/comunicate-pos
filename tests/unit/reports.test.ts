import { describe, expect, it } from 'vitest';
import { addDays, parseReportFilter, presetRange, reportQuerySchema, type ReportData } from '../../shared/reports';
import { csvCell, displayReportCell, reportCsv } from '../../server/services/reports.service';
import { adminPermissions, permissionKeys, sellerPermissions } from '../../shared/auth';
describe('Phase 8: fechas de Lima y validaciones', () => {
  const now = new Date('2026-01-01T04:30:00Z');
  it.each([
    ['today', '2025-12-31', '2025-12-31'], ['yesterday', '2025-12-30', '2025-12-30'],
    ['last7', '2025-12-25', '2025-12-31'], ['month', '2025-12-01', '2025-12-31'],
    ['previousMonth', '2025-11-01', '2025-11-30'], ['year', '2025-01-01', '2025-12-31'],
  ] as const)('%s no depende del huso del navegador', (preset, from, to) => expect(presetRange(preset, now)).toEqual({ from, to }));
  it('mes anterior al cambiar de año', () => expect(presetRange('previousMonth', new Date('2026-01-01T05:00:00Z'))).toEqual({ from: '2025-12-01', to: '2025-12-31' }));
  it('febrero bisiesto', () => expect(addDays('2024-03-01', -1)).toBe('2024-02-29'));
  it('rango personalizado incluye todo el último día', () => {
    const f = parseReportFilter({ preset: 'custom', from: '2026-09-30', to: '2026-10-01' }, 'general');
    expect(f.start.toISOString()).toBe('2026-09-30T05:00:00.000Z'); expect(f.end.toISOString()).toBe('2026-10-02T05:00:00.000Z');
  });
  it.each([{ from: '2026-02-30', to: '2026-03-01' }, { from: '2026-10-10' }, { preset: 'custom' }, { from: '2026-10-11', to: '2026-10-10' }, { from: '2020-01-01', to: '2026-10-10' }, { page: 0 }, { limit: 101 }, { group: 'hour' }, { status: 'CANCELLED' }, { operator: 'OTHER' }, { userId: "' OR TRUE --" }, { tenantId: 'bypass' }])('rechaza consulta inválida %j', raw => expect(reportQuerySchema.safeParse(raw).success).toBe(false));
  it('rechaza filtros de otros reportes sin ignorarlos', () => expect(() => parseReportFilter({ operator: 'BITEL' }, 'sales')).toThrow());
});
describe('Phase 8: exportación segura', () => {
  it.each(['=1+1', '+CMD', '-2+3', '@SUM(A1)', '  =1', '\t=1', '\r@TEST', '\n+TEST', '\u0000=1'])('neutraliza fórmula %j', value => expect(csvCell(value).startsWith('"\'')).toBe(true));
  it('comillas comas y saltos de línea', () => expect(csvCell('Á,"B"\nC')).toBe('"Á,""B""\nC"'));
  it('no altera identificadores normales ni céntimos exactos', () => { expect(csvCell('RECO-000101')).toBe('"RECO-000101"'); expect(csvCell('1250.01')).toBe('"1250.01"'); });
  it('fechas y etiquetas operativas', () => { expect(displayReportCell('status', 'PENDING')).toBe('REGISTRO PENDIENTE'); expect(displayReportCell('payment', 'CASH')).toBe('EFECTIVO'); expect(displayReportCell('date', '2026-10-11T04:30:00Z')).toContain('10/10/26'); });
  it('BOM y datos/totales seleccionados sin campos internos', () => {
    const data: ReportData = { type: 'sales', period: { from: '2026-10-01', to: '2026-10-10', timezone: 'America/Lima' }, generatedAt: '2026-10-10T12:00:00Z', summary: { salesRevenue: '0.30' }, labels: { salesRevenue: 'INGRESOS DE VENTAS' }, rows: [{ code: 'SALE-1', amount: '0.30', tokenHash: 'secret', dni: '12345678' }], columns: [{ key: 'code', label: 'VENTA' }, { key: 'amount', label: 'TOTAL', money: true }], total: 1, page: 1, limit: 25, tables: [], series: [], evolution: [] };
    const csv = reportCsv(data); expect(csv.charCodeAt(0)).toBe(0xfeff); expect(csv).toContain('0.30'); expect(csv).toContain('2026-10-01'); expect(csv).not.toContain('secret'); expect(csv).not.toContain('12345678');
  });
  it('permisos conservadores', () => { expect(permissionKeys).toContain('reports.export'); expect(adminPermissions).not.toContain('reports.read'); expect(sellerPermissions).not.toContain('reports.read'); });
});
