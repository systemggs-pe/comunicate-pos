import type { DniErrorCode } from '../../shared/dni.js';
export interface DniLookupResult {
  dni: string; firstName?: string; lastName?: string;
  paternalLastName?: string; maternalLastName?: string; fullName?: string; source: string;
}
export interface DniProvider { lookup(dni: string, signal?: AbortSignal): Promise<DniLookupResult | null> }
const messages: Record<DniErrorCode, string> = {
  DNI_INVALID: 'DNI inválido. Usa ocho dígitos.',
  DNI_NOT_FOUND: 'No se encontraron datos para este DNI. Puedes ingresar la información manualmente.',
  DNI_PROVIDER_UNAVAILABLE: 'No pudimos consultar el DNI en este momento. Puedes ingresar los datos manualmente.',
  DNI_PROVIDER_TIMEOUT: 'La consulta DNI tardó demasiado. Puedes ingresar los datos manualmente.',
  DNI_PROVIDER_RATE_LIMIT: 'La consulta DNI está temporalmente limitada. Puedes ingresar los datos manualmente.',
  DNI_PROVIDER_INVALID_RESPONSE: 'No recibimos datos válidos para este DNI. Puedes ingresar los datos manualmente.',
};
export class DniProviderError extends Error {
  constructor(public readonly code: DniErrorCode) { super(messages[code]); }
}
export const dniError = (code: DniErrorCode) => ({ code, message: messages[code] });
