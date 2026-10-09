export type RegistrationStatus = 'NOT_REGISTERED' | 'PENDING' | 'PROCESSING' | 'REGISTERED' | 'REJECTED' | 'CANCELLED';
export interface Client {
  id: string; code: string; dni: string; firstName: string; lastName: string;
  phone: string | null; email: string | null; createdAt: string; updatedAt: string; equipmentCount?: number;
}
export interface Imei {
  id: string; equipmentId: string; slot: number; value: string; type: 'PHYSICAL' | 'ESIM';
  requests?: RegistrationRequest[];
  registrationStatus: RegistrationStatus; registrationMethod: string | null;
  registrationStartedAt: string | null; registeredAt: string | null;
}
export interface Equipment {
  id: string; code: string; ownerId: string | null; owner: Client | null;
  origin: 'STORE' | 'EXTERNAL'; status: 'ACTIVE' | 'RETURNED' | 'BLOCKED' | 'ARCHIVED';
  commercialName?: string|null; color?: string|null; ram?: string|null; storage?: string|null; brand: string; model: string; serialNumber: string | null; createdAt: string;
  imeis: Imei[]; registrationStatus: 'NOT_REGISTERED' | 'PARTIALLY_REGISTERED' | 'REGISTERED';
  saleEquipment?: { id: string; unitPrice: string; isActive: boolean; sale: Sale }[];
}
export interface ClientDetails extends Client { equipment: Equipment[]; purchases?: Sale[] }
export interface HistoryEvent { id: string; equipmentId: string; imeiId: string | null; eventType: string; createdAt: string; metadata: Record<string, unknown> | null }
export interface ImeiInput { slot: number; value: string; type: 'PHYSICAL' | 'ESIM' }
export interface ClientInput { dni: string; firstName: string; lastName: string; phone?: string; email?: string }
export interface EquipmentInput { commercialName?:string|null; color?:string|null; ram?:string|null; storage?:string|null; brand: string; model: string; serialNumber?: string | null }
export interface RegistrationResolution { kind: 'NEW' | 'EXISTING'; equipment: Equipment | null; additions: ImeiInput[]; requiresConfirmation: boolean }
export interface RegistrationInput {
  client: ClientInput; imeis: ImeiInput[]; selectedImeis: string[];
  registration: { status: RegistrationStatus; method?: string | null };
  equipment?: EquipmentInput; expectedEquipmentId?: string; confirmAddImei?: boolean;
}
export type PaymentMethod = 'CASH' | 'YAPE' | 'PLIN' | 'CARD' | 'TRANSFER' | 'OTHER';
export interface Sale { accessories?:SaleAccessory[]; occurredAt?:string; id: string; code: string; buyerId: string; buyer: Client; status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED'; subtotal?: string; discount: string; total: string; paymentMethod: PaymentMethod; notes: string | null; createdAt: string; createdBy: { id: string; name: string } | null; equipmentCount?: number; _count?: { equipment: number }; equipment?: { id: string; unitPrice: string; equipment: Equipment }[] }
export type ClientReference = { id: string } | { client: ClientInput };
export interface SaleItemInput { confirmResale?:boolean; equipment?: EquipmentInput & { imeis: ImeiInput[] }; equipmentId?: string; owner?: ClientReference; unitPrice: string }
export interface SaleInput { buyer: ClientReference; items: SaleItemInput[]; paymentMethod: PaymentMethod; discount: string; notes?: string; accessories?:SaleAccessory[]; occurredAt?:string; idempotencyKey?:string }

export interface SaleAccessory { id?:string; name:string; quantity:number; unitPrice:string }
export interface RegistrationRequest { id:string; code:string; operationId:string; imeiId:string; status:"PENDING"|"COMPLETED"|"CANCELLED"; blockStatus:"BLOCKED"|"NOT_BLOCKED"; operator:string; phone:string; referencePhone:string|null; address:string; department:string; email:string; price:string; hasBox:boolean; conditions:string; occurredAt:string; completedAt:string|null; createdAt:string; createdBy?:{id:string;name:string}; updatedBy?:{id:string;name:string}; imei?:Imei & {equipment:Equipment}; history?:{id:string; action:string; createdAt:string; metadata:Record<string,unknown>|null;user:{name:string}}[] }
