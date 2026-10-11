import {beforeAll,afterAll,it,expect} from 'vitest';
import {phase9Fixture,fixtureOrigin} from '../../scripts/lib/phase9-fixture';
let fixture:Awaited<ReturnType<typeof phase9Fixture>>;
beforeAll(async()=>{fixture=await phase9Fixture();},60000);
afterAll(async()=>{if(fixture)await fixture.close();});
it('maintenance prevents audit/counter writes from GET exports and protected readiness while liveness remains available',async()=>{
 const previous=process.env.MAINTENANCE_MODE,audits=await fixture.db.auditLog.count(),limits=await fixture.db.authRateLimit.count();process.env.MAINTENANCE_MODE='true';
 try{expect((await fetch(fixture.base+'/api/health')).status).toBe(200);for(const path of ['/api/reports/export?type=sales&preset=month','/api/readiness','/api/auth/me'])expect((await fetch(fixture.base+path,{headers:{Cookie:fixture.cookie}})).status).toBe(503);expect(await fixture.db.auditLog.count()).toBe(audits);expect(await fixture.db.authRateLimit.count()).toBe(limits);}finally{if(previous===undefined)delete process.env.MAINTENANCE_MODE;else process.env.MAINTENANCE_MODE=previous;}
});
it('private readiness needs session and confirms live DB/storage without credentials',async()=>{expect((await fetch(fixture.base+'/api/readiness')).status).toBe(401);const response=await fetch(fixture.base+'/api/readiness',{headers:{Cookie:fixture.cookie}});expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');expect(await response.json()).toMatchObject({status:'ready',checks:{database:'PASS',storage:'PASS'}});});
it('atomic PostgreSQL export throttling limits concurrent downloads and returns Retry-After',async()=>{await fixture.db.authRateLimit.deleteMany();const before=await fixture.db.auditLog.count({where:{action:'REPORT_EXPORTED'}});const responses=await Promise.all(Array.from({length:16},()=>fetch(fixture.base+'/api/reports/export?type=sales&preset=month',{headers:{Cookie:fixture.cookie}})));expect(responses.filter(r=>r.status===200)).toHaveLength(10);expect(responses.filter(r=>r.status===429)).toHaveLength(6);for(const response of responses){if(response.status===429)expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);await response.arrayBuffer();}expect(await fixture.db.auditLog.count({where:{action:'REPORT_EXPORTED'}})).toBe(before+10);});
it('malicious search stays parameterized; invalid filters and actor impersonation fail',async()=>{
 await fixture.db.authRateLimit.deleteMany();
 const clients=await fixture.db.client.count();
 const response=await fetch(fixture.base+'/api/clients?q='+encodeURIComponent("'; DROP TABLE Client; --"),{headers:{Cookie:fixture.cookie}});
 expect(response.status).toBe(200);expect(await fixture.db.client.count()).toBe(clients);
 expect((await fetch(fixture.base+'/api/reports/sales?userId=not-a-uuid',{headers:{Cookie:fixture.cookie}})).status).toBe(400);
 for(const date of ['0000-01-01','9999-12-31'])expect((await fetch(fixture.base+`/api/reports/sales?preset=custom&from=${date}&to=${date}`,{headers:{Cookie:fixture.cookie}})).status).toBe(400);
 expect((await fetch(fixture.base+'/api/clients',{method:'POST',headers:{Cookie:fixture.cookie,Origin:fixtureOrigin,'Content-Type':'application/json'},body:JSON.stringify({userId:'forged',dni:'invalid'})})).status).toBe(403);
});
