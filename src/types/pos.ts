export type RegistrationStatus = 'NOT_REGISTERED' | 'PENDING' | 'PROCESSING' | 'REGISTERED' | 'REJECTED' | 'CANCELLED';
export interface Client {
  id: string; code: string; dni: string; firstName: string; lastName: string;
  phone: string | null; email: string | null; createdAt: string; updatedAt: string; equipmentCount?: number;
}
export interface Imei {
  id: string; equipmentId: string; slot: number; value: string; type: 'PHYSICAL' | 'ESIM';
  registrationStatus: RegistrationStatus; registrationMethod: string | null;
  registrationStartedAt: string | null; registeredAt: string | null;
}
export interface Equipment {
  id: string; code: string; ownerId: string | null; owner: Client | null;
  origin: 'STORE' | 'EXTERNAL'; status: 'ACTIVE' | 'RETURNED' | 'BLOCKED' | 'ARCHIVED';
  brand: string; model: string; serialNumber: string | null; createdAt: string;
  imeis: Imei[]; registrationStatus: 'NOT_REGISTERED' | 'PARTIALLY_REGISTERED' | 'REGISTERED';
}
export interface ClientDetails extends Client { equipment: Equipment[] }
export interface HistoryEvent { id: string; equipmentId: string; imeiId: string | null; eventType: string; createdAt: string; metadata: Record<string, unknown> | null }
export interface ImeiInput { slot: number; value: string; type: 'PHYSICAL' | 'ESIM' }
export interface ClientInput { dni: string; firstName: string; lastName: string; phone?: string; email?: string }
export interface EquipmentInput { brand: string; model: string; serialNumber?: string | null }
export interface RegistrationResolution { kind: 'NEW' | 'EXISTING'; equipment: Equipment | null; additions: ImeiInput[]; requiresConfirmation: boolean }
export interface RegistrationInput {
  client: ClientInput; imeis: ImeiInput[]; selectedImeis: string[];
  registration: { status: RegistrationStatus; method?: string | null };
  equipment?: EquipmentInput; expectedEquipmentId?: string; confirmAddImei?: boolean;
}
