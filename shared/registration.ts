import { imeiValueSchema } from './validation.js';

export function deriveRegistrationStatus(imeis: readonly { registrationStatus: string }[]) {
  const count = imeis.filter(i => i.registrationStatus === 'REGISTERED').length;
  if (count === 0) return 'NOT_REGISTERED';
  return count === imeis.length ? 'REGISTERED' : 'PARTIALLY_REGISTERED';
}

export function isDualImei(imeis: readonly { slot: number; value: string }[]) {
  const first = imeiValueSchema.safeParse(imeis.find(imei => imei.slot === 1)?.value);
  const second = imeiValueSchema.safeParse(imeis.find(imei => imei.slot === 2)?.value);
  return first.success && second.success && first.data !== second.data;
}
