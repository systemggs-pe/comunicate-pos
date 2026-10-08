import { describe, expect, it } from 'vitest';
import { dniSchema, imeiValueSchema, equipmentSchema, moneySchema } from '../../shared/validation';
import { deriveRegistrationStatus } from '../../shared/registration';
describe('Validaciones compartidas', () => {
  it('normaliza espacios, conserva ceros iniciales', () => { expect(dniSchema.parse(' 0012 3456 ')).toBe('00123456'); expect(imeiValueSchema.parse(' 001111111111111 ')).toBe('001111111111111'); });
  it.each(['1234567', '123456789', '1234A678', '1234-678'])('rechaza DNI %s', value => expect(dniSchema.safeParse(value).success).toBe(false));
  it.each(['11111111111111', '1111111111111111', '11111111111111A'])('rechaza IMEI %s', value => expect(imeiValueSchema.safeParse(value).success).toBe(false));
  it('rechaza IMEIs o slots repetidos', () => {
    const base = { origin: 'STORE', brand: 'Samsung', model: 'S26', imeis: [{ slot: 1, value: '111111111111111' }, { slot: 2, value: '111111111111111' }] };
    expect(equipmentSchema.safeParse(base).success).toBe(false);
    expect(equipmentSchema.safeParse({ ...base, imeis: [{ slot: 1, value: '111111111111111' }, { slot: 1, value: '222222222222222' }] }).success).toBe(false);
  });
  it('externo requiere propietario', () => expect(equipmentSchema.safeParse({ origin: 'EXTERNAL', brand: 'A', model: 'B', imeis: [{ slot: 1, value: '111111111111111' }] }).success).toBe(false));
  it('acepta sólo dinero decimal no negativo', () => { expect(moneySchema.parse('120.50')).toBe('120.50'); for (const value of ['-1', '1.001', '1e4', 'NaN']) expect(moneySchema.safeParse(value).success).toBe(false); });
  it('deriva estado desde cada IMEI', () => {
    expect(deriveRegistrationStatus([])).toBe('NOT_REGISTERED');
    expect(deriveRegistrationStatus([{ registrationStatus: 'PROCESSING' }])).toBe('NOT_REGISTERED');
    expect(deriveRegistrationStatus([{ registrationStatus: 'REGISTERED' }, { registrationStatus: 'NOT_REGISTERED' }])).toBe('PARTIALLY_REGISTERED');
    expect(deriveRegistrationStatus([{ registrationStatus: 'REGISTERED' }, { registrationStatus: 'REGISTERED' }])).toBe('REGISTERED');
  });
});
