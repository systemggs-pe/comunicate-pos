import 'dotenv/config';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {afterAll,expect,it} from 'vitest';
import {createPosService} from '../../server/services/pos.service';
import {createAuthService} from '../../server/services/auth.service';
import type {EvidenceStorageProvider} from '../../server/storage/provider';
import {workflowInput} from '../helpers/workflow';
import {seedTestAdmin,testEmail,testPassword,testOrigin} from '../helpers/auth';
import {clearEvidenceFixtures} from '../helpers/evidence';

const target=new URL(process.env.TEST_DATABASE_URL!);
if(!['127.0.0.1','localhost'].includes(target.hostname)||target.pathname!=='/communicate_pos_test')throw Error('DB dedicada requerida');
const db=new PrismaClient({datasources:{db:{url:target.toString()}}});
afterAll(async()=>{
 await clearEvidenceFixtures(db);
 await db.$transaction([db.foreignReceipt.deleteMany(),db.foreignReceiptIssuer.deleteMany()]);
 await db.$disconnect();
});

it('revierte la operación y el folio si falla el almacenamiento y guarda una sola vez al reintentar concurrentemente',async()=>{
 await clearEvidenceFixtures(db);
 await db.$transaction([db.foreignReceipt.deleteMany(),db.foreignReceiptIssuer.deleteMany(),db.session.deleteMany(),
  db.authRateLimit.deleteMany(),db.registrationRequestHistory.deleteMany(),db.registrationRequest.deleteMany(),
  db.registrationOperation.deleteMany(),db.saleAccessory.deleteMany(),db.equipmentHistory.deleteMany(),db.auditLog.deleteMany(),
  db.saleEquipment.deleteMany(),db.sale.deleteMany(),db.imei.deleteMany(),db.equipment.deleteMany(),db.client.deleteMany(),db.user.deleteMany()]);
 await seedTestAdmin(db);
 const login=await createAuthService(db).login({email:testEmail,password:testPassword},{ip:'127.0.0.1'});
 const session=await db.session.findFirstOrThrow({where:{userId:login.user.id}});
 await db.foreignReceiptIssuer.create({data:{format:1,config:{nombre:'EMISOR DEMO',rut:'DEMO12345'}}});
 const count=await db.foreignReceiptCounter.findUniqueOrThrow({where:{id:1}});
 const objects=new Map<string,Buffer>();let broken=true;
 const storage:EvidenceStorageProvider={
  async upload(key,bytes){if(broken&&key.endsWith('.webp'))throw Error('Test storage interruption');objects.set(key,bytes);},
  async download(key){const bytes=objects.get(key);if(!bytes)throw Error('Not found');return bytes;},
  async delete(key){objects.delete(key);},
  async exists(key){return objects.has(key);},
  async authorizeUpload(){throw Error('Fixture does not use signed PUT');},
  async authorizeDownload(){throw Error('Fixture does not use signed GET');},
 };
 const input=workflowInput();
 const evidence=[];
 for(const category of ['DNI_FRONT','DNI_BACK'] as const){
  const id=randomUUID(),checksum='f'.repeat(64);
  const asset=await db.evidenceAsset.create({data:{id,category,storageKey:`evidence/${id}.webp`,expectedMimeType:'image/png',
   operationKey:input.idempotencyKey,idempotencyKey:randomUUID(),createdById:login.user.id,ownerSessionId:session.id,
   checksum,expectedChecksum:checksum,expectedSize:8,fileSize:8,verifiedAt:new Date(),width:80,height:120,
   uploadExpiresAt:new Date(0),expiresAt:new Date(Date.now()+60000)}});
  evidence.push({category,assetId:asset.id,imeiValues:input.imeis.map(imei=>imei.value)});
 }
 const service=createPosService(db,{userId:login.user.id},session.id,false,storage,false,false,testOrigin);
 await expect(service.createRegistrationOperation({...input,evidence,requireReceipt:true})).rejects.toMatchObject({issues:[expect.objectContaining({path:['receipt']})]});
 const data={...input,evidence,requireReceipt:true,receipt:{kind:'MANUAL',format:1,price:'400',issuedAt:'2026-11-01T12:00'}};
 await expect(service.createRegistrationOperation(data)).rejects.toMatchObject({code:'REGISTRATION_RECEIPT_STORAGE'});
 expect(await db.registrationOperation.count()).toBe(0);
 expect(await db.foreignReceipt.count()).toBe(0);
 expect((await db.foreignReceiptCounter.findUniqueOrThrow({where:{id:1}})).last).toBe(count.last);
 expect(objects.size).toBe(0);
 broken=false;
 const [one,two]=await Promise.all([service.createRegistrationOperation(data),service.createRegistrationOperation(data)]);
 expect(one?.id).toBe(two?.id);expect(one?.requests).toHaveLength(2);
 expect(await db.foreignReceipt.count()).toBe(1);
 expect((await db.foreignReceiptCounter.findUniqueOrThrow({where:{id:1}})).last).toBe(count.last+1);
 expect(await db.equipmentReceiptEvidence.count()).toBe(1);
 expect(await db.registrationEvidence.count({where:{category:'PURCHASE_RECEIPT'}})).toBe(2);
 const attached=await db.equipmentReceiptEvidence.findFirstOrThrow({include:{evidenceAsset:true}});
 expect(attached.evidenceAsset.originalStorageKey).toBeNull();
 expect([...objects.keys()]).toEqual([attached.evidenceAsset.storageKey]);
});
