export function deriveRegistrationStatus(imeis: readonly { registrationStatus: string }[]) {
  const count = imeis.filter(i => i.registrationStatus === 'REGISTERED').length;
  if (count === 0) return 'NOT_REGISTERED';
  return count === imeis.length ? 'REGISTERED' : 'PARTIALLY_REGISTERED';
}
