import { createHash } from 'node:crypto';

import { Prisma, type PrismaClient, type EquipmentEventType } from '@prisma/client';

import { z } from 'zod';

import { equipmentSchema, idSchema, moneySchema } from '../../shared/validation.js';

import { cancelSaleSchema, saleFlowSchema, saleRequestSchema, salesQuerySchema, type clientReferenceSchema } from '../../shared/sales.js';

import { deriveRegistrationStatus } from '../../shared/registration.js';

import { repository, saleSummaryInclude, type Db } from '../repositories/pos.repository.js';

import type { AuditContext } from '../lib/audit.js';

import { DomainError } from '../lib/errors.js';



type Reference = z.infer<typeof clientReferenceSchema>;

interface Dependencies {

  actor?: AuditContext;

  transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T>;

  createEquipmentInTx: (tx: Db, input: z.infer<typeof equipmentSchema>) => Promise<{ id: string }>;

  history: (tx: Db, id: string, event: EquipmentEventType, imeiId?: string, userId?: string, metadata?: Prisma.InputJsonValue) => Promise<unknown>;

  audit: (tx: Db, action: string, entityType: string, id: string, userId?: string, metadata?: Prisma.InputJsonValue) => Promise<unknown>;

}

function summary<T extends { total: Prisma.Decimal; discount: Prisma.Decimal; _count: { equipment: number } }>(sale: T) { return { ...sale, subtotal: sale.total.add(sale.discount), equipmentCount: sale._count.equipment }; }

function dayRange(day: string) { const from = new Date(`${day}T00:00:00-05:00`); return { gte: from, lt: new Date(from.getTime() + 86400000) }; }

export function createSalesService(db: PrismaClient, helpers: Dependencies) {

  const { transaction, history, audit, createEquipmentInTx } = helpers;

  async function client(tx: Db, ref: Reference, owner = false) {

    if ('id' in ref) { const found = await tx.client.findUnique({ where: { id: ref.id } }); if (!found) throw new DomainError(404, owner ? 'Propietario no encontrado.' : 'Comprador no encontrado.', owner ? 'OWNER_NOT_FOUND' : 'CLIENT_NOT_FOUND'); return found; }

    const existing = await repository.findClientByDni(tx, ref.client.dni); if (existing) return existing;

    const created = await tx.client.create({ data: ref.client }); await audit(tx, 'CREATE', 'Client', created.id); return created;

  }

  async function validateItems(tx: Db, items: z.infer<typeof saleFlowSchema>['items'], confirmResale = false) {

    const values = items.flatMap(item => item.equipment?.imeis.map(i => i.value) ?? []);

    const ids = items.flatMap(item => item.equipmentId ? [item.equipmentId] : []);

    if (new Set(values).size !== values.length) throw new DomainError(409, 'Un IMEI se repite dentro de la venta.', 'IMEI_ALREADY_EXISTS');

    if (new Set(ids).size !== ids.length) throw new DomainError(409, 'Un equipo se repite dentro de la venta.', 'SALE_EQUIPMENT_CONFLICT');

    for (const item of items) if (item.equipment && new Set(item.equipment.imeis.map(i => i.slot)).size !== item.equipment.imeis.length) throw new DomainError(400, 'Los slots deben ser diferentes.', 'VALIDATION_ERROR');

    if (values.length && await tx.imei.findFirst({ where: { value: { in: values } } })) throw new DomainError(409, 'El IMEI ya está asociado a un equipo. Busque el equipo existente.', 'IMEI_ALREADY_EXISTS');

    for (const id of ids) {

      const equipment = await repository.getEquipmentById(tx, id);

      if (confirmResale && equipment.saleEquipment.length && !items.find(item=>item.equipmentId===id)?.confirmResale) throw new DomainError(409,'Confirma la nueva venta del equipo con venta anterior cancelada.','RESALE_CONFIRMATION_REQUIRED');
      if (equipment.origin !== 'STORE' || equipment.status !== 'ACTIVE') throw new DomainError(409, 'Sólo se venden equipos de tienda activos.', 'SALE_EQUIPMENT_CONFLICT');

      if (await tx.saleEquipment.findFirst({ where: { equipmentId: id, isActive: true } })) throw new DomainError(409, 'El equipo ya pertenece a una venta activa.', 'SALE_EQUIPMENT_CONFLICT');

    }

  }

  const accessories = (input: ReturnType<typeof saleRequestSchema.parse>) => 'accessories' in input ? input.accessories : [];

  const subtotalFor = (input: ReturnType<typeof saleRequestSchema.parse>) => accessories(input).reduce((sum,line)=>sum.add(new Prisma.Decimal(line.unitPrice).mul(line.quantity)), input.items.reduce((sum,line)=>sum.add(line.unitPrice),new Prisma.Decimal(0)));

  function parse(raw: unknown) {

    if (typeof raw === 'object' && raw) {

      if ('items' in raw && Array.isArray(raw.items)) { if (!raw.items.length) throw new DomainError(400, 'Agregue al menos un equipo.', 'SALE_EMPTY'); for (const item of raw.items) if (item && typeof item === 'object' && 'unitPrice' in item && !moneySchema.safeParse(item.unitPrice).success) throw new DomainError(400, 'Precio inválido. Use soles con máximo dos decimales y sin signo negativo.', 'INVALID_PRICE'); }

      if ('discount' in raw && !moneySchema.safeParse(raw.discount).success) throw new DomainError(400, 'Descuento inválido.', 'INVALID_TOTAL');

      if ('status' in raw && !['PENDING', 'COMPLETED'].includes(String(raw.status))) throw new DomainError(400, 'Estado inicial de venta inválido.', 'SALE_INVALID_STATUS');

    }

    return saleRequestSchema.parse(raw);

  }

  async function detail(tx: Db, id: string) { const sale = await repository.getSaleById(tx, id); return { ...summary(sale), equipment: sale.equipment.map(line => ({ ...line, equipment: { ...line.equipment, registrationStatus: deriveRegistrationStatus(line.equipment.imeis) } })) }; }

  return {

    resolveSale: (raw: unknown) => { const input = parse(raw); return transaction(async tx => { await validateItems(tx, input.items, 'buyer' in input); const subtotal = subtotalFor(input); const discount = new Prisma.Decimal(input.discount); if (subtotal.greaterThan('9999999999.99') || discount.greaterThan(subtotal)) throw new DomainError(400, 'El descuento supera el subtotal o el importe excede el máximo.', 'INVALID_TOTAL'); return { subtotal: subtotal.toFixed(2), discount: discount.toFixed(2), total: subtotal.sub(discount).toFixed(2) }; }); },

    createSale: (raw: unknown) => {

      const input = parse(raw);

      return transaction(async tx => {

        const key = 'idempotencyKey' in input ? input.idempotencyKey : undefined;

        const requestHash = key ? createHash('sha256').update(JSON.stringify(input)).digest('hex') : undefined;

        if (key) {

          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;

          const previous = await tx.sale.findUnique({where:{idempotencyKey:key}});

          if(previous) { if(previous.createdById!==helpers.actor?.userId || previous.requestHash!==requestHash) throw new DomainError(409,'Confirmación de otra operación.','IDEMPOTENCY_CONFLICT'); return detail(tx,previous.id); }

        }

        await validateItems(tx, input.items, 'buyer' in input);

        const subtotal = subtotalFor(input); const discount = new Prisma.Decimal(input.discount);

        if (subtotal.greaterThan('9999999999.99') || discount.greaterThan(subtotal)) throw new DomainError(400, 'El descuento supera el subtotal o el importe excede el máximo.', 'INVALID_TOTAL');

        const buyer = await client(tx, 'buyer' in input ? input.buyer : { id: input.buyerId });

        const lines: { equipmentId: string; unitPrice: string }[] = [];

        for (const item of input.items) {

          if ('equipment' in item && item.equipment) {

            const owner = await client(tx, item.owner ?? { id: buyer.id }, true);

            const equipment = await createEquipmentInTx(tx, equipmentSchema.parse({ ...item.equipment, serialNumber: item.equipment.serialNumber ?? undefined, origin: 'STORE', ownerId: owner.id }));

            lines.push({ equipmentId: equipment.id, unitPrice: item.unitPrice });

          } else if (item.equipmentId) {

            const equipment = await repository.getEquipmentById(tx, item.equipmentId);

            if ('buyer' in input) {

              const owner = await client(tx, 'owner' in item && item.owner ? item.owner : { id: equipment.ownerId ?? buyer.id }, true);

              if (equipment.ownerId && equipment.ownerId !== owner.id) throw new DomainError(409, 'Este equipo ya está asociado a otro propietario.', 'OWNER_MISMATCH');

              if (!equipment.ownerId) { await tx.equipment.update({ where: { id: equipment.id }, data: { ownerId: owner.id } }); await history(tx, equipment.id, 'OWNER_ASSIGNED', undefined, undefined, { ownerId: owner.id }); }

            }

            lines.push({ equipmentId: equipment.id, unitPrice: item.unitPrice });

          }

        }

        const sale = await tx.sale.create({ data: { buyerId: buyer.id, status: input.status, paymentMethod: input.paymentMethod, discount, total: subtotal.sub(discount), notes: input.notes, occurredAt:'occurredAt' in input && input.occurredAt ? new Date(input.occurredAt) : undefined, idempotencyKey:key, requestHash, accessories:{create:accessories(input)}, createdById: helpers.actor?.userId ?? input.createdById, equipment: { create: lines } } });

        for (const line of lines) await history(tx, line.equipmentId, 'SOLD', undefined, input.createdById, { saleId: sale.id, saleCode: sale.code });

        await audit(tx, 'CREATE', 'Sale', sale.id, input.createdById);

        return detail(tx, sale.id);

      });

    },

    updateSaleNotes: (id: unknown, raw: unknown) => { const saleId=idSchema.parse(id); const input=z.object({notes:z.string().trim().max(1000)}).strict().parse(raw); return transaction(async tx=>{ const sale=await repository.getSaleById(tx,saleId); if(!['PENDING','COMPLETED'].includes(sale.status))throw new DomainError(409,'La venta no admite correcciones.','SALE_INVALID_STATUS'); await tx.sale.update({where:{id:saleId},data:input}); await audit(tx,'UPDATE','Sale',saleId,undefined,{fields:['notes']}); return detail(tx,saleId); }); },

    getSaleById: (id: unknown) => detail(db, idSchema.parse(id)),

    cancelSale: (id: unknown, raw: unknown) => { const saleId = idSchema.parse(id); const input = cancelSaleSchema.parse(raw); return transaction(async tx => {

      const sale = await repository.getSaleById(tx, saleId);

      if (sale.status === 'CANCELLED') throw new DomainError(409, 'La venta ya está cancelada.', 'SALE_ALREADY_CANCELLED');

      if (!['COMPLETED', 'PENDING'].includes(sale.status)) throw new DomainError(409, 'La venta no admite cancelación básica.', 'SALE_INVALID_STATUS');

      await tx.sale.update({ where: { id: saleId }, data: { status: 'CANCELLED' } });

      for (const line of sale.equipment) await history(tx, line.equipmentId, 'SALE_CANCELLED', undefined, undefined, { saleId, saleCode: sale.code, reason: input.reason });

      await audit(tx, 'CANCEL', 'Sale', saleId, undefined, { reason: input.reason });

      return detail(tx, saleId);

    }); },

    listSales: async (raw: unknown = {}) => {

      const { q, offset, limit, status, from, to } = salesQuerySchema.parse(raw);

      const where: Prisma.SaleWhereInput = { status, occurredAt: { ...(from ? { gte: dayRange(from).gte } : {}), ...(to ? { lt: dayRange(to).lt } : {}) }, ...(q ? { AND: q.split(/\s+/).filter(Boolean).map(term => ({ OR: [{ code: { contains: term, mode: 'insensitive' as const } }, { buyer: { dni: { contains: term } } }, { buyer: { firstName: { contains: term, mode: 'insensitive' as const } } }, { buyer: { lastName: { contains: term, mode: 'insensitive' as const } } }, { equipment: { some: { equipment: { imeis: { some: { value: term } } } } } }] })) } : {}) };

      return (await db.sale.findMany({ where, include: saleSummaryInclude, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: offset, take: limit })).map(summary);

    },

    dashboard: () => transaction(async tx => {

      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); const where = { status: 'COMPLETED' as const, occurredAt: dayRange(today) };

      const result = await tx.sale.aggregate({ where, _count: true, _sum: { total: true } });

      return { day: today, salesToday: result._count, revenueToday: (result._sum.total ?? new Prisma.Decimal(0)).toFixed(2), equipmentSoldToday: await tx.saleEquipment.count({ where: { sale: where } }) };

    }),

  };

}
