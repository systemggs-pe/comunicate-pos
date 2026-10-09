export interface DniData { dni: string; firstName: string; lastName: string }
export const dniErrorCodes = ['DNI_INVALID', 'DNI_NOT_FOUND', 'DNI_PROVIDER_UNAVAILABLE', 'DNI_PROVIDER_TIMEOUT', 'DNI_PROVIDER_RATE_LIMIT', 'DNI_PROVIDER_INVALID_RESPONSE'] as const;
export type DniErrorCode = typeof dniErrorCodes[number];
export type DniLookupResponse<TClient> =
  | { source: 'LOCAL'; client: TClient }
  | { source: 'EXTERNAL'; data: DniData }
  | { source: 'NONE'; error: { code: DniErrorCode; message: string } };
