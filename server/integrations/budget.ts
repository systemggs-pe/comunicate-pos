import {createHash} from 'node:crypto';
import type {PrismaClient} from '@prisma/client';
import {DomainError} from '../lib/errors.js';
export async function externalBudget(db:PrismaClient,userId:string,kind:string,maximum:number,seconds=86400){
 const key=createHash('sha256').update(`external:${kind}:${userId}`).digest('hex');
 const rows=await db.$queryRaw<{attempts:number}[]>`INSERT INTO "AuthRateLimit" (key,attempts,"expiresAt") VALUES (${key},1,now()+${seconds}*interval '1 second') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN "AuthRateLimit"."expiresAt"<=now() THEN 1 ELSE "AuthRateLimit".attempts+1 END,"expiresAt"=CASE WHEN "AuthRateLimit"."expiresAt"<=now() THEN now()+${seconds}*interval '1 second' ELSE "AuthRateLimit"."expiresAt" END RETURNING attempts`;
 if(rows[0].attempts>maximum)throw new DomainError(429,'LÍMITE DE CONSULTAS ALCANZADO. CONTINÚA MANUALMENTE.','EXTERNAL_QUOTA_REACHED');
}
