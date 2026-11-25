import { PrismaClient } from '@prisma/client';
import { writeFile } from 'node:fs/promises';

const db = new PrismaClient();
async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  if (!['127.0.0.1', 'localhost'].includes(target.hostname)) throw new Error('Se requiere la base local.');
  const rows = await db.$queryRaw<{table:string; id:string; code:string; date:Date}[]>`
    SELECT 'Client' AS "table", id, code, "createdAt" AS date FROM "Client"
    UNION ALL SELECT 'Equipment', id, code, "createdAt" FROM "Equipment"
    UNION ALL SELECT 'Sale', id, code, "occurredAt" FROM "Sale"
    UNION ALL SELECT 'RegistrationRequest', id, code, "occurredAt" FROM "RegistrationRequest"
    ORDER BY "table", date, id
  `;
  if (process.argv.includes('--verify')) {
    const prefixes: Record<string, string> = {Client:'CL', Equipment:'EQ-', Sale:'SALE-', RegistrationRequest:'RECO-'};
    const counts: Record<string, number> = {};
    for (const row of rows) {
      const number = counts[row.table] = (counts[row.table] ?? 0) + 1;
      const expected = prefixes[row.table] + String(number).padStart(5, '0');
      if (row.code !== expected) throw new Error(`Código fuera de secuencia en ${row.table}: ${row.code}, esperado ${expected}`);
    }
    console.log(counts);
    return;
  }
  const file = 'outputs/codigos-pos-' + Date.now() + '.json';
  await writeFile(file, JSON.stringify(rows, null, 2), {flag:'wx'});
  console.log(file, rows.length);
}
main().finally(() => db.$disconnect());
