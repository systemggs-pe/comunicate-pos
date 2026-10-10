import {createHash} from 'node:crypto';
import {type PrismaClient} from '@prisma/client';
import {idSchema} from '../../shared/validation.js';
import {deletionSchema} from '../../shared/workflow.js';
import {writeAudit,type AuditContext} from '../lib/audit.js';
import {DomainError} from '../lib/errors.js';
import type {Db} from '../repositories/pos.repository.js';
type Kind='sale'|'request'|'equipment';
export function createDeletionService(_db:PrismaClient,actor:AuditContext,transaction:<T>(fn:(tx:Db)=>Promise<T>)=>Promise<T>){
 async function plan(tx:Db,kind:Kind,id:string,removeOrphanEquipment=false){
  const sale=kind==='sale'?await tx.sale.findUnique({where:{id},include:{equipment:true,accessories:true}}):null;
  const request=kind==='request'?await tx.registrationRequest.findUnique({where:{id},include:{imei:true}}):null;
  const equipment=kind==='equipment'?await tx.equipment.findUnique({where:{id}}):null;
  if(!sale&&!request&&!equipment)throw new DomainError(404,'OPERACIÓN NO ENCONTRADA.','DELETE_NOT_FOUND');
  const requestDevice=request?await tx.equipment.findUniqueOrThrow({where:{id:request.imei.equipmentId},include:{saleEquipment:true,imeis:{include:{requests:true}}}}):null;
  const canRemoveOrphanEquipment=!!requestDevice&&requestDevice.origin==='EXTERNAL'&&!requestDevice.saleEquipment.length&&requestDevice.imeis.flatMap(i=>i.requests).every(r=>r.id===id);
  let equipmentIds=sale?sale.equipment.map(line=>line.equipmentId):equipment?[equipment.id]:[];
  if(request&&removeOrphanEquipment){const dependencies=await tx.equipment.findUniqueOrThrow({where:{id:request.imei.equipmentId},include:{saleEquipment:true,imeis:{include:{requests:true}}}});if(dependencies.origin!=='EXTERNAL'||dependencies.saleEquipment.length||dependencies.imeis.flatMap(i=>i.requests).some(r=>r.id!==id))throw new DomainError(409,'EL EQUIPO TIENE OTRAS OPERACIONES; ELIMINA SOLO LA SOLICITUD.','DELETE_SHARED_DEPENDENCY');equipmentIds=[dependencies.id];}
  const devices=await tx.equipment.findMany({where:{id:{in:equipmentIds}},include:{saleEquipment:true,imeis:{include:{requests:true}},history:true}});
  if(devices.some(device=>device.saleEquipment.some(line=>line.saleId!==sale?.id)))throw new DomainError(409,'EL EXPEDIENTE TIENE UNA VENTA FUERA DEL CONJUNTO. ABRE LA VENTA Y CONFIRMA SU ELIMINACIÓN INTEGRAL.','DELETE_SHARED_DEPENDENCY');
  const imeiIds=devices.flatMap(device=>device.imeis.map(i=>i.id));
  const requests=devices.flatMap(device=>device.imeis.flatMap(i=>i.requests));if(request&&!requests.some(r=>r.id===id))requests.push(request);
  const requestIds=requests.map(r=>r.id),histories=await tx.registrationRequestHistory.findMany({where:{requestId:{in:requestIds}}});
  const operationIds=[...new Set(requests.map(r=>r.operationId))];const operations=await tx.registrationOperation.findMany({where:{id:{in:operationIds}},include:{requests:true}});const orphanOperations=operations.filter(o=>o.requests.every(r=>requestIds.includes(r.id))).map(o=>o.id);
  const individualHistory=request&&!equipmentIds.length?await tx.equipmentHistory.findMany({where:{imeiId:request.imeiId,createdAt:{gte:request.createdAt},eventType:{in:['IMEI_REGISTRATION_STARTED','IMEI_REGISTRATION_UPDATED','IMEI_REGISTERED']}}}):[];
  const entities={sales:sale?[sale.id]:[],saleLines:sale?sale.equipment.map(l=>l.id):[],accessories:sale?sale.accessories.map(l=>l.id):[],equipment:equipmentIds,imeis:imeiIds,requests:requestIds,requestHistory:histories.map(h=>h.id),equipmentHistory:[...devices.flatMap(d=>d.history.map(h=>h.id)),...individualHistory.map(h=>h.id)],operations:orphanOperations};
  const revisions=[...(sale?[sale.updatedAt.toISOString()]:[]),...devices.map(d=>d.updatedAt.toISOString()),...requests.map(r=>r.updatedAt.toISOString())].sort();
  const counts=Object.fromEntries(Object.entries(entities).map(([key,ids])=>[key,ids.length]));
  const fingerprint=createHash('sha256').update(JSON.stringify({kind,id,removeOrphanEquipment,entities:Object.fromEntries(Object.entries(entities).map(([key,ids])=>[key,[...ids].sort()])),revisions})).digest('hex');
  return {kind,id,code:sale?.code??request?.code??equipment!.code,counts,entities,fingerprint,clientPreserved:true,canRemoveOrphanEquipment,removeOrphanEquipment,affectedImei:request?.imeiId};
 }
 return {
 deletionPreview:(kind:Kind,id:unknown,removeOrphanEquipment=false)=>transaction(tx=>plan(tx,kind,idSchema.parse(id),removeOrphanEquipment)),
 deletePermanently:async(kind:Kind,id:unknown,raw:unknown)=>{const key=idSchema.parse(id),input=deletionSchema.parse(raw);return transaction(async tx=>{
  // Stable lock ordering; serializable revalidation also covers newly attached dependencies.
  const initial=await plan(tx,kind,key,input.removeOrphanEquipment);for(const equipmentId of [...initial.entities.equipment].sort())await tx.$queryRaw`SELECT id FROM "Equipment" WHERE id=${equipmentId}::uuid FOR UPDATE`;
  if(kind==='request')await tx.$queryRaw`SELECT id FROM "RegistrationRequest" WHERE id=${key}::uuid FOR UPDATE`;
  const current=await plan(tx,kind,key,input.removeOrphanEquipment);if(current.fingerprint!==input.fingerprint)throw new DomainError(409,'CAMBIARON LAS DEPENDENCIAS. REVISA Y CONFIRMA EL NUEVO RESUMEN.','DELETE_PLAN_CHANGED');
  const e=current.entities;
  await tx.registrationRequestHistory.deleteMany({where:{id:{in:e.requestHistory}}});await tx.registrationRequest.deleteMany({where:{id:{in:e.requests}}});await tx.registrationOperation.deleteMany({where:{id:{in:e.operations}}});
  await tx.equipmentHistory.deleteMany({where:{id:{in:e.equipmentHistory}}});await tx.saleAccessory.deleteMany({where:{id:{in:e.accessories}}});await tx.saleEquipment.deleteMany({where:{id:{in:e.saleLines}}});await tx.sale.deleteMany({where:{id:{in:e.sales}}});await tx.imei.deleteMany({where:{id:{in:e.imeis}}});await tx.equipment.deleteMany({where:{id:{in:e.equipment}}});
  if(current.affectedImei&&!e.imeis.includes(current.affectedImei)){const remaining=await tx.registrationRequest.findFirst({where:{imeiId:current.affectedImei}});await tx.imei.update({where:{id:current.affectedImei},data:{registrationStatus:remaining?.status??null,registrationStartedAt:remaining?.createdAt??null,registrationMethod:remaining?.operator??null,legacyRegistrationStatus:null,legacyRegisteredAt:null,registeredAt:remaining?.status==='REGISTERED'?remaining.completedAt:null,registeredById:remaining?.status==='REGISTERED'?remaining.completedById:null}});}
  const deletedIds=Object.values(e).flat();await tx.auditLog.deleteMany({where:{entityId:{in:deletedIds}}});
  if(!actor.userId)throw new DomainError(401,'SESIÓN REQUERIDA.','AUTH_REQUIRED');
  // The reason is required for deliberate confirmation but not retained as free text/PII.
  await writeAudit(tx,{userId:actor.userId},'PERMANENT_DELETION',kind==='sale'?'Sale':kind==='request'?'RegistrationRequest':'Equipment',key,{counts:current.counts,ids:deletedIds,reasonProvided:true});
  return {deleted:true,counts:current.counts,clientPreserved:true};
 });}
 };
}
