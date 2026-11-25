import {afterAll,expect,it} from 'vitest';
import {PrismaClient} from '@prisma/client';
const url=new URL(process.env.TEST_DATABASE_URL!);
if(!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/communicate_pos_test')throw Error('TEST DB ONLY');
const db=new PrismaClient({datasources:{db:{url:url.toString()}}});
afterAll(()=>db.$disconnect());
it('AUD-07 migrated database retains intentional SQL constraints, triggers and sequences',async()=>{
 const constraints=await db.$queryRaw<{name:string;validated:boolean}[]>`SELECT conname AS name,convalidated AS validated FROM pg_constraint WHERE connamespace='public'::regnamespace`;
 for(const name of ['request_completion_integrity','evidence_ready','evidence_sizes','evidence_expected_type'])expect(constraints.some(c=>c.name===name&&c.validated),name).toBe(true);
 const triggers=await db.$queryRaw<{name:string}[]>`SELECT tgname AS name FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace)`;
 for(const name of ['evidence_link_immutable','evidence_link_scope_guard','evidence_dimensions_guard','client_identity_reuse_guard'])expect(triggers.some(t=>t.name===name),name).toBe(true);
 const indexes=await db.$queryRaw<{name:string;definition:string}[]>`SELECT indexname AS name,indexdef AS definition FROM pg_indexes WHERE schemaname='public'`;
 expect(indexes.find(i=>i.name==='request_distinct_phone_per_operation')?.definition).toContain('UNIQUE');
 const sequences=await db.$queryRaw<{name:string}[]>`SELECT sequencename AS name FROM pg_sequences WHERE schemaname='public'`;
 expect(sequences.map(s=>s.name)).toEqual(expect.arrayContaining(['client_code_seq','equipment_code_seq','registration_code_seq','sale_code_seq']));
});
it('AUD-07 Prisma agrees with SQL defaults and six non-cascading FK update actions',async()=>{
 const rows=await db.$queryRaw<{name:string;action:string}[]>`SELECT conname AS name,confupdtype::text AS action FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace`;
 for(const name of ['ClientDocument_clientId_fkey','ClientDocument_evidenceAssetId_fkey','ClientDocument_createdById_fkey','EvidenceAsset_ownerClientId_fkey','CompanySettings_updatedById_fkey','RegistrationRequest_completedById_fkey'])expect(rows.find(r=>r.name===name)?.action,name).toBe('a');
 const defaults=await db.$queryRaw<{table:string;column:string;value:string|null}[]>`SELECT table_name AS "table",column_name AS "column",column_default AS value FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('ClientDocument','CompanySettings')`;
 expect(defaults.find(c=>c.table==='ClientDocument'&&c.column==='id')?.value).toContain('gen_random_uuid');
 for(const table of ['ClientDocument','CompanySettings'])expect(defaults.find(c=>c.table===table&&c.column==='updatedAt')?.value).toMatch(/now\(\)|CURRENT_TIMESTAMP/);
});
