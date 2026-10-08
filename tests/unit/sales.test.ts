import { describe, expect, it } from 'vitest';
import { cents, decimalMoney, cancelSaleSchema, saleFlowSchema, salesQuerySchema } from '../../shared/sales';
describe('Dinero y validación de ventas', () => {
  it('céntimos exactos', () => { expect(decimalMoney(cents('0.10') + cents('0.20') - cents('0.05'))).toBe('0.25'); expect(decimalMoney(cents('9999999999.99'))).toBe('9999999999.99'); });
  it.each(['-1', 'NaN', '1e4', '1.001', '1,500'])('precio inválido %s', value => expect(() => cents(value)).toThrow());
  it('no acepta totales suministrados ni estado cancelado al crear', () => { expect(saleFlowSchema.safeParse({ total: '100', status: 'CANCELLED' }).success).toBe(false); });
  it('cancelación necesita confirmación y motivo', () => { expect(cancelSaleSchema.safeParse({ confirm: false, reason: 'Motivo' }).success).toBe(false); expect(cancelSaleSchema.safeParse({ confirm: true, reason: '' }).success).toBe(false); });
  it('fecha inválida y rango invertido', () => { expect(salesQuerySchema.safeParse({ from: '2026-02-30' }).success).toBe(false); expect(salesQuerySchema.safeParse({ from: '2026-10-09', to: '2026-10-08' }).success).toBe(false); });
});
