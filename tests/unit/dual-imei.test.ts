import { describe, expect, it } from 'vitest';
import { equipmentSchema, imeiListSchema, registrationFlowSchema } from '../../shared/validation';
import { deriveRegistrationStatus, isDualImei } from '../../shared/registration';

const imeis = [{ slot: 1, value: '011111111111110' }, { slot: 2, value: '022222222222220' }];
describe('Doble IMEI por datos', () => {
  it.each(['Samsung', 'Honor', 'Xiaomi', 'Motorola', 'Apple', 'Desconocida'])('%s admite dos IMEI', brand => {
    const equipment = equipmentSchema.parse({ origin: 'STORE', brand, model: 'Dual', imeis });
    expect(isDualImei(equipment.imeis)).toBe(true);
  });
  it('single y segundo vacío conservan un IMEI', () => {
    for (const values of [imeis.slice(0, 1), [imeis[0], { slot: 2, value: '  ' }]]) {
      const parsed = imeiListSchema.parse(values);
      expect(parsed).toHaveLength(1); expect(isDualImei(parsed)).toBe(false);
    }
  });
  it('más de dos posiciones se rechazan aunque haya campos vacíos', () => {
    expect(imeiListSchema.safeParse([imeis[0], { slot: 2, value: '' }, { slot: 2, value: '' }]).success).toBe(false);
  });
  it.each(['123', '12345678901234X', '1234567890123456', '111-111111111111'])('segundo inválido %s se rechaza y no es dual', value => {
    const values = [imeis[0], { slot: 2, value }];
    expect(imeiListSchema.safeParse(values).success).toBe(false); expect(isDualImei(values)).toBe(false);
  });
  it('conserva ceros y rechaza espacios en IMEI sin corregirlos', () => {
    expect(imeiListSchema.parse(imeis).map(i=>i.value)).toEqual(imeis.map(i=>i.value));
    expect(isDualImei(imeis)).toBe(true);
    expect(imeiListSchema.safeParse(imeis.map(i=>({...i,value:` ${i.value.slice(0,3)} ${i.value.slice(3)} `}))).success).toBe(false);
  });
  it('valores iguales normalizados se rechazan', () => {
    const values = [imeis[0], { slot: 2, value: ` ${imeis[0].value} ` }];
    expect(imeiListSchema.safeParse(values).success).toBe(false); expect(isDualImei(values)).toBe(false);
  });
  it.each([[], [{ slot: 1, value: '' }, imeis[1]], [{ slot: 1, value: 'invalid' }, imeis[1]]].map(values => [values]))('no inventa capacidad dual con datos incompletos', values => expect(isDualImei(values)).toBe(false));
  it('selección repetida o ajena se rechaza', () => {
    const flow = { client: { dni: '00123456', firstName: 'Ana', lastName: 'Pérez' }, imeis, registration: { status: 'REGISTERED' } };
    for (const selectedImeis of [[imeis[0].value, imeis[0].value], ['099999999999993']]) expect(registrationFlowSchema.safeParse({ ...flow, selectedImeis }).success).toBe(false);
  });
  it.each([
    [['REGISTERED'], 'REGISTERED'], [['REGISTERED', 'NOT_REGISTERED'], 'PARTIALLY_REGISTERED'],
    [['NOT_REGISTERED', 'REGISTERED'], 'PARTIALLY_REGISTERED'], [['REGISTERED', 'REGISTERED'], 'REGISTERED'],
    [['NOT_REGISTERED', 'NOT_REGISTERED'], 'NOT_REGISTERED'],
  ])('estado %j => %s', (statuses, expected) => expect(deriveRegistrationStatus(statuses.map(registrationStatus => ({ registrationStatus })))).toBe(expected));
});
