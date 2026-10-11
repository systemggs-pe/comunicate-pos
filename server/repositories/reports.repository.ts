import { Prisma } from '@prisma/client';
import type { Db } from './pos.repository.js';
import type { ReportFilter, ReportRow, ReportType } from '../../shared/reports.js';

const brandExpression = Prisma.sql`upper(regexp_replace(trim(e.brand), '[[:space:]]+', ' ', 'g'))`;
function clauses(parts: Prisma.Sql[]) { return Prisma.join(parts, ' AND '); }
function scopes(f: ReportFilter) {
  const sales = [Prisma.sql`s."occurredAt" >= ${f.start} AND s."occurredAt" < ${f.end}`];
  const requests = [Prisma.sql`r."occurredAt" >= ${f.start} AND r."occurredAt" < ${f.end}`];
  const equipment = [Prisma.sql`e."createdAt" >= ${f.start} AND e."createdAt" < ${f.end}`];
  const requestIdentity: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (f.userId) { sales.push(Prisma.sql`s."createdById" = ${f.userId}::uuid`); requests.push(Prisma.sql`r."createdById" = ${f.userId}::uuid`); }
  if (f.paymentMethod) sales.push(Prisma.sql`s."paymentMethod"::text = ${f.paymentMethod}`);
  if (f.operator) requestIdentity.push(Prisma.sql`r.operator::text = ${f.operator}`);
  if (f.status) requestIdentity.push(Prisma.sql`r.status::text = ${f.status}`);
  if (f.brand) {
    const match = Prisma.sql`${brandExpression} = upper(regexp_replace(trim(${f.brand}::text), '[[:space:]]+', ' ', 'g'))`;
    equipment.push(match);
    sales.push(Prisma.sql`EXISTS (SELECT 1 FROM "SaleEquipment" se JOIN "Equipment" e ON e.id=se."equipmentId" WHERE se."saleId"=s.id AND ${match})`);
    requestIdentity.push(Prisma.sql`EXISTS (SELECT 1 FROM "Imei" i JOIN "Equipment" e ON e.id=i."equipmentId" WHERE i.id=r."imeiId" AND ${match})`);
  }
  requests.push(...requestIdentity);
  return { sales: clauses(sales), requests: clauses(requests), equipment: clauses(equipment), requestIdentity: clauses(requestIdentity) };
}
function ctes(f: ReportFilter) {
  const w = scopes(f);
  return Prisma.sql`WITH sales AS (SELECT s.* FROM "Sale" s WHERE ${w.sales}), requests AS (SELECT r.* FROM "RegistrationRequest" r WHERE ${w.requests}), equipment AS (SELECT e.*, ${brandExpression} AS "normalizedBrand", (SELECT count(*)::int FROM "Imei" i WHERE i."equipmentId"=e.id) AS "imeiCount" FROM "Equipment" e WHERE ${w.equipment})`;
}
function bucket(column: Prisma.Sql, f: ReportFilter) { return Prisma.sql`to_char(date_trunc(${f.group}::text, ${column} AT TIME ZONE 'America/Lima'), 'YYYY-MM-DD')`; }
// SQL numeric is serialized as fixed-point text; BigInt counts are never sent to JSON.
async function query(db: Db, sql: Prisma.Sql): Promise<ReportRow[]> {
  const rows = await db.$queryRaw<Record<string, unknown>[]>(sql);
  return rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Prisma.Decimal ? value.toFixed(2) : typeof value === 'bigint' ? Number(value) : value instanceof Date ? value.toISOString() : value as string | number | null])));
}
export const reportRepository = {
  async summary(db: Db, f: ReportFilter, type: ReportType) {
    const base = ctes(f);
    if (type === 'general' || type === 'sales' || type === 'registrations') return (await query(db, Prisma.sql`${base} SELECT
      (SELECT count(*)::int FROM sales) AS "salesCount", (SELECT coalesce(sum(total),0)::numeric FROM sales) AS "salesRevenue",
      (SELECT count(*)::int FROM "SaleEquipment" se JOIN sales s ON s.id=se."saleId") AS "equipmentSold",
      (SELECT count(*)::int FROM requests) AS "registrationCount", (SELECT coalesce(sum(price),0)::numeric FROM requests) AS "registrationAmount",
      (SELECT count(*)::int FROM "Client" WHERE "createdAt">=${f.start} AND "createdAt"<${f.end}) AS "newClients"`))[0];
    if (type === 'equipment') return (await query(db, Prisma.sql`${base} SELECT count(*)::int AS "equipmentCount", count(*) FILTER(WHERE origin='EXTERNAL')::int AS "externalEquipment", count(*) FILTER(WHERE "imeiCount"=1)::int AS "singleImei", count(*) FILTER(WHERE "imeiCount"=2)::int AS "doubleImei", coalesce(sum("imeiCount"),0)::int AS "imeiCount", (SELECT count(*)::int FROM "SaleEquipment" se JOIN sales s ON s.id=se."saleId") AS "equipmentSold" FROM equipment`))[0];
    if (type === 'clients') return (await query(db, Prisma.sql`${base}, operations AS (
      SELECT "buyerId" AS client, 'SALE:'||id AS operation FROM sales UNION ALL
      SELECT e."ownerId", 'RECO:'||r."operationId" FROM requests r JOIN "Imei" i ON i.id=r."imeiId" JOIN "Equipment" e ON e.id=i."equipmentId" GROUP BY e."ownerId",r."operationId"
    ) SELECT (SELECT count(*)::int FROM "Client") AS "totalClients", (SELECT count(*)::int FROM "Client" WHERE "createdAt">=${f.start} AND "createdAt"<${f.end}) AS "newClients", (SELECT count(DISTINCT "buyerId")::int FROM sales) AS "buyingClients", (SELECT count(DISTINCT e."ownerId")::int FROM requests r JOIN "Imei" i ON i.id=r."imeiId" JOIN "Equipment" e ON e.id=i."equipmentId") AS "registrationClients", (SELECT count(*)::int FROM (SELECT client FROM operations WHERE client IS NOT NULL GROUP BY client HAVING count(*)>1) repeated) AS "repeatClients"`))[0];
    const creator = f.userId ? Prisma.sql`AND "createdById"=${f.userId}::uuid` : Prisma.empty;
    const completer = f.userId ? Prisma.sql`AND "completedById"=${f.userId}::uuid` : Prisma.empty;
    return (await query(db, Prisma.sql`${base} SELECT (SELECT count(*)::int FROM sales) AS "salesCount", (SELECT coalesce(sum(total),0)::numeric FROM sales) AS "salesRevenue", (SELECT coalesce(sum(price),0)::numeric FROM requests) AS "registrationAmount", (SELECT count(*)::int FROM "RegistrationRequest" WHERE "createdAt">=${f.start} AND "createdAt"<${f.end} ${creator}) AS "requestsCreated", (SELECT count(*)::int FROM "RegistrationRequest" WHERE "completedAt">=${f.start} AND "completedAt"<${f.end} ${completer}) AS "requestsCompleted"`))[0];
  },
  async salesSeries(db: Db, f: ReportFilter) {
    return query(db, Prisma.sql`${ctes(f)}, grouped AS (SELECT ${bucket(Prisma.sql`s."occurredAt"`, f)} AS date, count(*)::int AS count, sum(total)::numeric AS amount FROM sales s GROUP BY 1), days AS (SELECT DISTINCT ${bucket(Prisma.sql`d AT TIME ZONE 'America/Lima'`, f)} AS date FROM generate_series(${f.start}::timestamptz AT TIME ZONE 'America/Lima', (${f.end}::timestamptz AT TIME ZONE 'America/Lima')-interval '1 day',interval '1 day') d) SELECT days.date, coalesce(g.count,0)::int AS count, coalesce(g.amount,0)::numeric AS amount FROM days LEFT JOIN grouped g USING(date) ORDER BY date`);
  },
  async evolution(db: Db, f: ReportFilter) {
    const w = scopes(f);
    // Completion belongs to its real timestamp/actor, independent of creation cohort.
    const creator = f.userId ? Prisma.sql`AND r."createdById"=${f.userId}::uuid` : Prisma.empty;
    const completer = f.userId ? Prisma.sql`AND r."completedById"=${f.userId}::uuid` : Prisma.empty;
    return query(db, Prisma.sql`WITH created AS (SELECT ${bucket(Prisma.sql`r."createdAt"`, f)} AS date,count(*)::int AS created,count(*) FILTER(WHERE status='PENDING')::int AS pending FROM "RegistrationRequest" r WHERE r."createdAt">=${f.start} AND r."createdAt"<${f.end} AND ${w.requestIdentity} ${creator} GROUP BY 1), completed AS (SELECT ${bucket(Prisma.sql`r."completedAt"`, f)} AS date,count(*)::int AS completed FROM "RegistrationRequest" r WHERE r."completedAt">=${f.start} AND r."completedAt"<${f.end} AND ${w.requestIdentity} ${completer} GROUP BY 1) SELECT coalesce(c.date,d.date) AS date,coalesce(created,0)::int AS created,coalesce(pending,0)::int AS pending,coalesce(completed,0)::int AS completed FROM created c FULL JOIN completed d USING(date) ORDER BY date`);
  },
  async groups(db: Db, f: ReportFilter, kind: 'states' | 'operators' | 'payments' | 'brands') {
    const base = ctes(f);
    if (kind === 'states') return query(db, Prisma.sql`${base} SELECT status::text AS name,count(*)::int AS count,round(100.0*count(*)/nullif(sum(count(*)) OVER(),0),2)::text AS percent FROM requests GROUP BY status ORDER BY status`);
    if (kind === 'operators') return query(db, Prisma.sql`${base} SELECT operator::text AS name,count(*)::int AS count,count(*) FILTER(WHERE status='REGISTERED')::int AS registered,count(*) FILTER(WHERE status='PENDING')::int AS pending,count(*) FILTER(WHERE status='BLOCKED')::int AS blocked FROM requests GROUP BY operator ORDER BY operator`);
    if (kind === 'payments') return query(db, Prisma.sql`${base} SELECT "paymentMethod"::text AS name,count(*)::int AS count,sum(total)::numeric AS amount,coalesce(round(100.0*sum(total)/nullif(sum(sum(total)) OVER(),0),2),0)::text AS percent FROM sales GROUP BY "paymentMethod" ORDER BY "paymentMethod"`);
    return query(db, Prisma.sql`${base} SELECT "normalizedBrand" AS name,count(*)::int AS count FROM equipment GROUP BY "normalizedBrand" ORDER BY count DESC,name`);
  },
  async details(db: Db, f: ReportFilter, type: Exclude<ReportType, 'general'>, exportLimit?: number) {
    const base = ctes(f), limit = exportLimit ?? f.limit, offset = exportLimit ? 0 : (f.page - 1) * f.limit;
    let select: Prisma.Sql;
    if (type === 'sales') select = Prisma.sql`SELECT s.id,s.code,s."occurredAt" AS date,s."paymentMethod"::text AS payment,s.total::numeric AS amount,coalesce(u.name,'SIN USUARIO') AS worker,(SELECT count(*)::int FROM "SaleEquipment" se WHERE se."saleId"=s.id) AS equipment FROM sales s LEFT JOIN "User" u ON u.id=s."createdById"`;
    else if (type === 'registrations') select = Prisma.sql`SELECT r.id,r.code,r."occurredAt" AS date,r.status::text AS status,r.operator::text AS operator,r.price::numeric AS amount,e.code AS equipment,e.brand,coalesce(u.name,'SIN USUARIO') AS creator,coalesce(v.name,'SIN FINALIZADOR') AS completer,r."createdAt" AS created,r."completedAt" AS completed FROM requests r JOIN "Imei" i ON i.id=r."imeiId" JOIN "Equipment" e ON e.id=i."equipmentId" LEFT JOIN "User" u ON u.id=r."createdById" LEFT JOIN "User" v ON v.id=r."completedById"`;
    else if (type === 'equipment') select = Prisma.sql`SELECT e.id,e.code,e."createdAt" AS date,e.brand,e.model,e.origin::text AS origin,e."imeiCount" AS imeis,EXISTS(SELECT 1 FROM "SaleEquipment" se WHERE se."equipmentId"=e.id)::text AS sold FROM equipment e`;
    else if (type === 'clients') select = Prisma.sql`SELECT c.id,c.code,c."createdAt" AS date,c."firstName"||' '||c."lastName" AS name,(SELECT count(*)::int FROM sales s WHERE s."buyerId"=c.id) AS purchases,(SELECT count(*)::int FROM requests r JOIN "Imei" i ON i.id=r."imeiId" JOIN "Equipment" e ON e.id=i."equipmentId" WHERE e."ownerId"=c.id) AS requests FROM "Client" c WHERE (c."createdAt">=${f.start} AND c."createdAt"<${f.end}) OR EXISTS(SELECT 1 FROM sales s WHERE s."buyerId"=c.id) OR EXISTS(SELECT 1 FROM requests r JOIN "Imei" i ON i.id=r."imeiId" JOIN "Equipment" e ON e.id=i."equipmentId" WHERE e."ownerId"=c.id)`;
    else select = Prisma.sql`SELECT u.id,u.code,u.name,u.status::text AS status,
      coalesce(s.count,0)::int AS sales,coalesce(s.amount,0)::numeric AS amount,coalesce(c.count,0)::int AS created,coalesce(d.count,0)::int AS completed,coalesce(a.amount,0)::numeric AS "serviceAmount"
      FROM "User" u
      LEFT JOIN (SELECT "createdById" AS actor,count(*) AS count,sum(total) AS amount FROM sales GROUP BY 1) s ON s.actor=u.id
      LEFT JOIN (SELECT "createdById" AS actor,count(*) AS count FROM "RegistrationRequest" WHERE "createdAt">=${f.start} AND "createdAt"<${f.end} GROUP BY 1) c ON c.actor=u.id
      LEFT JOIN (SELECT "completedById" AS actor,count(*) AS count FROM "RegistrationRequest" WHERE "completedAt">=${f.start} AND "completedAt"<${f.end} GROUP BY 1) d ON d.actor=u.id
      LEFT JOIN (SELECT "createdById" AS actor,sum(price) AS amount FROM requests GROUP BY 1) a ON a.actor=u.id
      WHERE (${f.userId ?? null}::uuid IS NULL OR u.id=${f.userId ?? null}::uuid) AND (u.status='ACTIVE' OR s.count>0 OR c.count>0 OR d.count>0 OR a.amount IS NOT NULL)`;
    const rows = await query(db, Prisma.sql`${base}, result AS (${select}) SELECT *,count(*) OVER()::int AS "rowCount" FROM result ORDER BY code,id LIMIT ${limit} OFFSET ${offset}`);
    // Count is separate only for an empty page, so out-of-range pages retain their total.
    const total = rows.length ? Number(rows[0].rowCount) : Number((await query(db, Prisma.sql`${base}, result AS (${select}) SELECT count(*)::int AS count FROM result`))[0].count);
    for (const row of rows) delete row.rowCount;
    return { rows, total };
  },
};
