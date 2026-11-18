import {applyRegistrationIdentityChanges,saveRegistrationIdentity} from '../documents/save-registration-identity.js';
import {autoAttachClientIdentity} from '../documents/auto-attach-identity.js';
import {assertPrepared,attachOperationEvidence,lockAsset} from '../evidence/lifecycle.js';
import {movistarDeclarationCategory} from '../../shared/evidence.js';
import {lockForeignReceiptCounter} from './foreign-receipts.service.js';
import {attachRegistrationReceipt,reserveRegistrationReceipt,retainUploadedReceipt} from './registration-receipt.service.js';
import type {EvidenceStorageProvider} from '../storage/provider.js';
import {reuseClientDocuments} from '../documents/reuse.js';
import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { equipmentSchema, idSchema, type resolveRegistrationSchema, type registrationSchema } from '../../shared/validation.js';
import { operationalRegistrationSchema, requestBulkSchema, requestEditSchema, requestQuerySchema, requestTransitionSchema } from '../../shared/workflow.js';
import type { z } from 'zod';
import { repository, type Db } from '../repositories/pos.repository.js';
import { DomainError } from '../lib/errors.js';
import { writeAudit, type AuditContext } from '../lib/audit.js';

interface Helpers {
  transaction:<T>(fn:(tx:Db)=>Promise<T>)=>Promise<T>;
  resolveInTx:(tx:Db,input:z.infer<typeof resolveRegistrationSchema>)=>Promise<{equipment:{id:string;ownerId:string|null}|null;requiresConfirmation:boolean;additions:z.infer<typeof equipmentSchema>['imeis']}>;
  createEquipmentInTx:(tx:Db,input:z.infer<typeof equipmentSchema>)=>Promise<{id:string;ownerId:string|null}>;
  updateRegistrationInTx:(tx:Db,value:string,input:z.infer<typeof registrationSchema>, managed?:boolean)=>Promise<unknown>;
}
const requestInclude = { applicant:true, imei:{include:{equipment:{include:{owner:true,imeis:{orderBy:{slot:'asc' as const}},saleEquipment:{include:{sale:true}}}}}}, createdBy:{select:{id:true,name:true}}, updatedBy:{select:{id:true,name:true}},completedBy:{select:{id:true,name:true}} } satisfies Prisma.RegistrationRequestInclude;
export function createRegistrationRequestsService(db:PrismaClient, actor:AuditContext, helpers:Helpers, sessionId?:string,autoAttachIdentity=false,saveClientIdentity=false,evidenceStorage?:EvidenceStorageProvider,origin='') {
  const actorId = () => { if (!actor.userId) throw new DomainError(401,'Sesión requerida.','AUTH_REQUIRED'); return actor.userId; };
  async function detail(tx:Db,id:string) {
    const request=await tx.registrationRequest.findUnique({where:{id},include:{...requestInclude,
      evidence:{where:{category:movistarDeclarationCategory,evidenceAsset:{status:'READY'}},select:{evidenceAssetId:true}},
      history:{include:{user:{select:{id:true,name:true}}},orderBy:{createdAt:'asc'}}}});
    if(!request)throw new DomainError(404,'Solicitud no encontrada.','REQUEST_NOT_FOUND');
    const {evidence,...result}=request;
    return {...result,hasMovistarDeclaration:evidence.length>0};
  }
  const audit = (tx:Db,action:string,id:string,metadata?:Prisma.InputJsonValue)=>writeAudit(tx,actor,action,'RegistrationRequest',id,metadata);
  async function transition(tx:Db,id:string,input:z.infer<typeof requestTransitionSchema>) {
    const found=await detail(tx,id);
    await tx.$queryRaw`SELECT id FROM "Equipment" WHERE id=${found.imei.equipmentId}::uuid FOR UPDATE`;
    const expected=input.action==='UNBLOCK'?'BLOCKED':'PENDING';
    if(found.status!==expected)throw new DomainError(409,'ACCIÓN INCOMPATIBLE CON EL ESTADO ACTUAL.','REQUEST_INVALID_TRANSITION');
    const now=new Date(),userId=actorId();
    await tx.registrationRequest.update({where:{id},data:{status:'REGISTERED',completedAt:now,completedById:userId,updatedById:userId}});
    await helpers.updateRegistrationInTx(tx,found.imei.value,{status:'REGISTERED',method:found.operator,ownerId:found.imei.equipment.ownerId??undefined},true);
    const metadata={from:found.status,to:'REGISTERED',action:input.action,reason:input.reason};
    await tx.registrationRequestHistory.create({data:{requestId:id,userId,action:input.action,metadata}});
    await audit(tx,'REGISTRATION_REQUEST_REGISTERED',id,metadata);
    return detail(tx,id);
  }
  function search(raw:unknown){
    const {q,status,equipmentId,clientId,limit,offset,missingMovistarDeclaration}=requestQuerySchema.parse(raw);
    const filters:Prisma.RegistrationRequestWhereInput[]=[];
    if(clientId)filters.push({OR:[{applicantId:clientId},{applicantId:null,imei:{equipment:{ownerId:clientId}}}]});
    if(q)for(const term of q.split(/\s+/)){
      const contains={contains:term,mode:'insensitive' as const};
      const person:Prisma.ClientWhereInput={OR:[{dni:contains},{otherDocumentNumber:contains},{fullName:contains},{firstName:contains},{lastName:contains}]};
      filters.push({OR:[{code:contains},{imei:{value:{contains:term}}},{applicant:person},{applicantId:null,imei:{equipment:{owner:person}}}]});
    }
    const where:Prisma.RegistrationRequestWhereInput={
      status,imei:{equipmentId},AND:filters,
      ...(missingMovistarDeclaration?{operator:'MOVISTAR',evidence:{none:{category:movistarDeclarationCategory,evidenceAsset:{status:'READY'}}}}:{}),
    };
    return {where,limit,offset};
  }
  return {
    createRegistrationOperation: async(raw:unknown)=>{
      const input=operationalRegistrationSchema.parse(raw), userId=actorId();
      const requestHash=createHash('sha256').update(JSON.stringify(input)).digest('hex');
      async function replay(tx:Db) {
        const previous=await tx.registrationOperation.findUnique({where:{idempotencyKey:input.idempotencyKey},include:{requests:{include:requestInclude,orderBy:{code:'asc'}}}});
        if(previous&&(previous.createdById!==userId||previous.requestHash!==requestHash))throw new DomainError(409,'La clave de confirmación pertenece a otra operación.','IDEMPOTENCY_CONFLICT');return previous;
      }
      const alreadySaved=await replay(db);if(alreadySaved)return alreadySaved;
      const movistarImeis=input.requests.filter(request=>request.operator==='MOVISTAR').map(request=>request.value);
      const declarations=input.evidence?.filter(row=>row.category===movistarDeclarationCategory)??[];
      if(declarations.length!==movistarImeis.length||declarations.some(row=>
        row.imeiValues.length!==1||!movistarImeis.includes(row.imeiValues[0]))){
        throw new DomainError(400,'Adjunta una declaración jurada válida por cada IMEI de Movistar.','MOVISTAR_DECLARATION_REQUIRED');
      }
      const needsGenerated=input.receipt&&input.receipt.kind!=='STORED';
      const staged=needsGenerated?await reserveRegistrationReceipt(db,input.idempotencyKey,actor,sessionId,evidenceStorage):undefined;
      try { return await helpers.transaction(async tx=>{
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.idempotencyKey}))`;
        const previous=await replay(tx);if(previous)return previous;
        if(needsGenerated)await lockForeignReceiptCounter(tx);
        const resolved=await helpers.resolveInTx(tx,{dni:input.client.dni,imeis:input.imeis});
        if(input.expectedEquipmentId&&input.expectedEquipmentId!==resolved.equipment?.id)throw new DomainError(409,'Cambió el equipo seleccionado. Vuelve a consultar.','IMEI_EQUIPMENT_CONFLICT');
        if(resolved.requiresConfirmation&&(!input.confirmAddImei||input.expectedEquipmentId!==resolved.equipment?.id))throw new DomainError(409,'Confirme el IMEI adicional para el mismo equipo.','IMEI_ASSOCIATION_CONFIRMATION_REQUIRED');
        let equipment=resolved.equipment;
        if(!equipment){
          if(!input.equipment)throw new DomainError(400,'Complete el equipo.','VALIDATION_ERROR');
          let client=await repository.findClientByDni(tx,input.client.dni);
          if(!client){client=await tx.client.create({data:input.client});await writeAudit(tx,actor,'CLIENT_CREATED','Client',client.id);}
          equipment=await helpers.createEquipmentInTx(tx,equipmentSchema.parse({...input.equipment,serialNumber:input.equipment.serialNumber??undefined,ownerId:client.id,origin:input.origin??'EXTERNAL',imeis:input.imeis}));
        }else{
          await tx.$queryRaw`SELECT id FROM "Equipment" WHERE id=${equipment.id}::uuid FOR UPDATE`;
          for(const imei of resolved.additions){const added=await tx.imei.create({data:{...imei,equipmentId:equipment.id}});await tx.equipmentHistory.create({data:{equipmentId:equipment.id,imeiId:added.id,eventType:'IMEI_ADDED',userId}});await writeAudit(tx,actor,'IMEI_CREATED','Imei',added.id);}
        }
        if(input.clientNameCorrection){
          const correction=input.clientNameCorrection;
          const client=await tx.client.findUnique({where:{id:correction.clientId}});
          if(!client||client.dni!==input.client.dni||equipment.ownerId!==client.id)throw new DomainError(409,'LA CORRECCIÓN NO CORRESPONDE AL CLIENTE.','CLIENT_CORRECTION_SCOPE');
          await tx.$queryRaw`SELECT id FROM "Client" WHERE id=${client.id}::uuid FOR UPDATE`;
          if((client.fullName||[client.firstName,client.lastName].filter(Boolean).join(' '))!==correction.expectedName)throw new DomainError(409,'EL NOMBRE CAMBIÓ. CONSULTA EL CLIENTE NUEVAMENTE.','CLIENT_CORRECTION_CONFLICT');
          await tx.client.update({where:{id:client.id},data:{fullName:correction.fullName,firstName:'',lastName:''}});
          await writeAudit(tx,actor,'CLIENT_NAME_CORRECTED','Client',client.id,{fields:['fullName']});
        }
        const operation=await tx.registrationOperation.create({data:{idempotencyKey:input.idempotencyKey,requestHash,createdById:userId}});
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('registration-number'))`;
        const sequence=await tx.$queryRaw<{last_value:bigint;is_called:boolean}[]>`SELECT last_value,is_called FROM registration_code_seq`;
        if(Number(sequence[0].last_value)+(sequence[0].is_called?input.requests.length:input.requests.length-1)>999999)throw new DomainError(409,'NUMERACIÓN RECO AGOTADA; SE REQUIERE AMPLIACIÓN CONTROLADA.','REGISTRATION_CODE_EXHAUSTED');
        const createdRequests:{id:string;value:string}[]=[];
        for(const item of input.requests){
          const imei=await tx.imei.findUniqueOrThrow({where:{value:item.value}});
          if(imei.equipmentId!==equipment.id)throw new DomainError(409,'IMEI de otro equipo.','IMEI_EQUIPMENT_CONFLICT');
          if(imei.registrationStatus!==null||await tx.registrationRequest.findFirst({where:{imeiId:imei.id,}}))throw new DomainError(409,'Este IMEI ya está registrado o tiene una solicitud vigente.','REQUEST_ALREADY_ACTIVE');
          const {value,mode,...fields}=item;const status=mode==='BLOCKED'?'BLOCKED':'PENDING';
          const request=await tx.registrationRequest.create({data:{...fields,referencePhone:item.referencePhone||item.phone,status,occurredAt:new Date(item.occurredAt),price:new Prisma.Decimal(item.price),operationId:operation.id,imeiId:imei.id,createdById:userId,updatedById:userId}});
          await helpers.updateRegistrationInTx(tx,value,{status,method:item.operator,ownerId:equipment.ownerId??undefined},true);
          await tx.registrationRequestHistory.create({data:{requestId:request.id,userId,action:'CREATED',metadata:{status}}});
          await audit(tx,'REGISTRATION_REQUEST_CREATED',request.id,{operationId:operation.id,status});
          createdRequests.push({id:request.id,value});
        }
        // Lock the client before assets, matching client-document reuse and replacement.
        if(saveClientIdentity&&equipment.ownerId)await tx.$queryRaw`SELECT id FROM "Client" WHERE id=${equipment.ownerId}::uuid FOR UPDATE`;
        const manualIdentity=(input.evidence??[]).filter(row=>row.category==='DNI_FRONT'||row.category==='DNI_BACK');
        if(manualIdentity.some(row=>row.imeiValues.length!==createdRequests.length)||new Set(manualIdentity.map(row=>row.category)).size!==manualIdentity.length){
          throw new DomainError(400,'Adjunta una sola foto por lado del DNI para todos los IMEIs del trámite.','CLIENT_DOCUMENT_SCOPE');
        }
        await attachOperationEvidence(tx,input.evidence??[],input.idempotencyKey,createdRequests,actor,sessionId);
        if(declarations.length>1){
          const assets=await tx.evidenceAsset.findMany({where:{id:{in:declarations.map(row=>row.assetId)}},select:{checksum:true}});
          if(new Set(assets.map(asset=>asset.checksum)).size!==declarations.length){
            throw new DomainError(400,'Sube un PDF distinto para cada IMEI de Movistar.','MOVISTAR_DECLARATION_DUPLICATE');
          }
        }
        const identityChanges=input.identityChanges??[];
        const documents=[...input.documentEvidence];
        if(identityChanges.length){
          if(!saveClientIdentity||!equipment.ownerId)throw new DomainError(403,'Se requiere permiso para guardar el DNI.','PERMISSION_REQUIRED');
          const selected=await applyRegistrationIdentityChanges(tx,equipment.ownerId,identityChanges,manualIdentity.map(row=>row.category),actor);
          documents.push(...selected.map(documentId=>({documentId,imeiValues:createdRequests.map(request=>request.value)})));
        }
        if(documents.length){if(!equipment.ownerId)throw new DomainError(409,'CLIENTE REQUERIDO.','CLIENT_DOCUMENT_SCOPE');await reuseClientDocuments(tx,documents,equipment.ownerId,createdRequests,actor);}
        if(autoAttachIdentity)for(const request of createdRequests)await autoAttachClientIdentity(tx,request.id,actor);
        if(saveClientIdentity&&equipment.ownerId)await saveRegistrationIdentity(tx,equipment.ownerId,manualIdentity.map(row=>row.assetId),actor,true);
        if(input.receipt)await attachRegistrationReceipt(tx,{choice:input.receipt,equipmentId:equipment.id,operationKey:input.idempotencyKey,
         requests:createdRequests,actor,sessionId,origin,staged,storage:evidenceStorage,entered:input.imeis.map(imei=>imei.value)});
        else if(input.evidence?.some(row=>row.category==='PURCHASE_RECEIPT'))await retainUploadedReceipt(tx,equipment.id,createdRequests);
        return replay(tx);
      }); }catch(error){
        if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002'){const previous=await replay(db);if(previous)return previous;}throw error;
      }finally{await staged?.release().catch(()=>undefined);}
    },
    listRegistrationRequests:async(raw:unknown={})=>{const {where,limit,offset}=search(raw);return db.registrationRequest.findMany({where,include:requestInclude,orderBy:[{createdAt:'desc'},{id:'asc'}],take:limit,skip:offset});},
    registrationSummary:async(raw:unknown={})=>{const {where}=search(raw);const [total,filtered]=await Promise.all([db.registrationRequest.count(),db.registrationRequest.count({where})]);return {total,filtered};},
    getRegistrationRequest:(id:unknown)=>detail(db,idSchema.parse(id)),
    updateRegistrationRequest:(id:unknown,raw:unknown,canAttachDeclaration=false)=>{
      const requestId=idSchema.parse(id),{declarationAssetId,...input}=requestEditSchema.parse(raw),userId=actorId();
      if(declarationAssetId&&!canAttachDeclaration)throw new DomainError(403,'Se requiere permiso para adjuntar la declaración.','PERMISSION_REQUIRED');
      return helpers.transaction(async tx=>{
        const current=await tx.registrationRequest.findUnique({where:{id:requestId},select:{operationId:true}});
        if(!current)throw new DomainError(404,'Solicitud no encontrada.','REQUEST_NOT_FOUND');
        await tx.$queryRaw`SELECT id FROM "RegistrationOperation" WHERE id=${current.operationId}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "RegistrationRequest" WHERE id=${requestId}::uuid FOR UPDATE`;
        const found=await detail(tx,requestId);
        const operator=input.operator??found.operator;
        const declaration=await tx.registrationEvidence.findUnique({where:{
          registrationRequestId_category:{registrationRequestId:requestId,category:movistarDeclarationCategory},
        }});
        if(operator==='MOVISTAR'&&!found.hasMovistarDeclaration&&!declarationAssetId){
          throw new DomainError(400,'Adjunta una declaración jurada válida para el IMEI de esta solicitud.','MOVISTAR_DECLARATION_REQUIRED');
        }
        if(declarationAssetId){
          if(operator!=='MOVISTAR'||(declaration&&(!found.hasMovistarDeclaration||declaration.evidenceAssetId!==declarationAssetId)))throw new DomainError(409,'La declaración no corresponde al estado de esta solicitud. Actualiza el expediente.','MOVISTAR_DECLARATION_CONFLICT');
          if(!declaration){
            const asset=assertPrepared(await lockAsset(tx,declarationAssetId),userId,sessionId,movistarDeclarationCategory);
            if(asset.sourceRequestId!==requestId)throw new DomainError(409,'Declaración de otra solicitud.','EVIDENCE_SCOPE_MISMATCH');
            const duplicate=await tx.registrationEvidence.findFirst({where:{registrationRequest:{operationId:current.operationId,id:{not:requestId}},category:movistarDeclarationCategory,evidenceAsset:{checksum:asset.checksum}}});
            if(duplicate)throw new DomainError(400,'Sube un PDF distinto para cada IMEI de Movistar.','MOVISTAR_DECLARATION_DUPLICATE');
            await tx.evidenceAsset.update({where:{id:asset.id},data:{status:'READY'}});
            const link=await tx.registrationEvidence.create({data:{registrationRequestId:requestId,evidenceAssetId:asset.id,category:movistarDeclarationCategory,createdById:userId}});
            await writeAudit(tx,actor,'EVIDENCE_UPLOADED','RegistrationEvidence',link.id,{requestId,category:movistarDeclarationCategory,assetId:asset.id});
          }
        }
        const snapshot={phone:found.phone,referencePhone:found.referencePhone,address:found.address,province:found.province,department:found.department,email:found.email,operator:found.operator,price:found.price.toFixed(2),hasBox:found.hasBox,occurredAt:found.occurredAt.toISOString()};
        const referencePhone=input.referencePhone===undefined?found.referencePhone||input.phone||found.phone:input.referencePhone||input.phone||found.phone;
        await tx.registrationRequest.update({where:{id:requestId},data:{...input,referencePhone,occurredAt:input.occurredAt?new Date(input.occurredAt):undefined,updatedById:userId}});
        await tx.registrationRequestHistory.create({data:{requestId,userId,action:'EDITED',metadata:{before:snapshot,changes:input}}});
        await audit(tx,'REGISTRATION_REQUEST_UPDATED',requestId,{fields:Object.keys(input),...(declarationAssetId?{declarationAttached:true}:{})});
        return detail(tx,requestId);
      });
    },
    transitionRegistrationRequest:(id:unknown,raw:unknown)=>helpers.transaction(tx=>transition(tx,idSchema.parse(id),requestTransitionSchema.parse(raw))),
    completeRegistrationRequests:async(raw:unknown)=>{
      const input=requestBulkSchema.parse(raw);const results=[];
      for(const id of input.ids){try{await helpers.transaction(tx=>transition(tx,id,{confirm:true,action:'MARK_REGISTERED',reason:input.reason}));results.push({id,success:true});}catch(error){results.push({id,success:false,code:error instanceof DomainError?error.code:'CONCURRENT_CONFLICT'});}}
      return results;
    },
  };
}
