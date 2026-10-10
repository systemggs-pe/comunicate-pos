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
const requestInclude = { imei:{include:{equipment:{include:{owner:true,imeis:{orderBy:{slot:'asc' as const}},saleEquipment:{include:{sale:true}}}}}}, createdBy:{select:{id:true,name:true}}, updatedBy:{select:{id:true,name:true}},completedBy:{select:{id:true,name:true}} } satisfies Prisma.RegistrationRequestInclude;
export function createRegistrationRequestsService(db:PrismaClient, actor:AuditContext, helpers:Helpers) {
  const actorId = () => { if (!actor.userId) throw new DomainError(401,'Sesión requerida.','AUTH_REQUIRED'); return actor.userId; };
  async function detail(tx:Db,id:string) {
    const request=await tx.registrationRequest.findUnique({where:{id},include:{...requestInclude,history:{include:{user:{select:{id:true,name:true}}},orderBy:{createdAt:'asc'}}}});
    if(!request)throw new DomainError(404,'Solicitud no encontrada.','REQUEST_NOT_FOUND');return request;
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
  return {
    createRegistrationOperation: async(raw:unknown)=>{
      const input=operationalRegistrationSchema.parse(raw), userId=actorId();
      const requestHash=createHash('sha256').update(JSON.stringify(input)).digest('hex');
      async function replay(tx:Db) {
        const previous=await tx.registrationOperation.findUnique({where:{idempotencyKey:input.idempotencyKey},include:{requests:{include:requestInclude,orderBy:{code:'asc'}}}});
        if(previous&&(previous.createdById!==userId||previous.requestHash!==requestHash))throw new DomainError(409,'La clave de confirmación pertenece a otra operación.','IDEMPOTENCY_CONFLICT');return previous;
      }
      try { return await helpers.transaction(async tx=>{
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.idempotencyKey}))`;
        const previous=await replay(tx);if(previous)return previous;
        const resolved=await helpers.resolveInTx(tx,{dni:input.client.dni,imeis:input.imeis});
        if(input.expectedEquipmentId&&input.expectedEquipmentId!==resolved.equipment?.id)throw new DomainError(409,'Cambió el equipo seleccionado. Vuelve a consultar.','IMEI_EQUIPMENT_CONFLICT');
        if(resolved.requiresConfirmation&&(!input.confirmAddImei||input.expectedEquipmentId!==resolved.equipment?.id))throw new DomainError(409,'Confirme el IMEI adicional para el mismo equipo.','IMEI_ASSOCIATION_CONFIRMATION_REQUIRED');
        let equipment=resolved.equipment;
        if(!equipment){
          if(!input.equipment)throw new DomainError(400,'Complete el equipo.','VALIDATION_ERROR');
          let client=await repository.findClientByDni(tx,input.client.dni);
          if(!client){client=await tx.client.create({data:input.client});await writeAudit(tx,actor,'CLIENT_CREATED','Client',client.id);}
          equipment=await helpers.createEquipmentInTx(tx,equipmentSchema.parse({...input.equipment,serialNumber:input.equipment.serialNumber??undefined,ownerId:client.id,origin:'EXTERNAL',imeis:input.imeis}));
        }else{
          await tx.$queryRaw`SELECT id FROM "Equipment" WHERE id=${equipment.id}::uuid FOR UPDATE`;
          for(const imei of resolved.additions){const added=await tx.imei.create({data:{...imei,equipmentId:equipment.id}});await tx.equipmentHistory.create({data:{equipmentId:equipment.id,imeiId:added.id,eventType:'IMEI_ADDED',userId}});await writeAudit(tx,actor,'IMEI_CREATED','Imei',added.id);}
        }
        const operation=await tx.registrationOperation.create({data:{idempotencyKey:input.idempotencyKey,requestHash,createdById:userId}});
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('registration-number'))`;
        const sequence=await tx.$queryRaw<{last_value:bigint;is_called:boolean}[]>`SELECT last_value,is_called FROM registration_code_seq`;
        if(Number(sequence[0].last_value)+(sequence[0].is_called?input.requests.length:input.requests.length-1)>999999)throw new DomainError(409,'NUMERACIÓN RECO AGOTADA; SE REQUIERE AMPLIACIÓN CONTROLADA.','REGISTRATION_CODE_EXHAUSTED');
        for(const item of input.requests){
          const imei=await tx.imei.findUniqueOrThrow({where:{value:item.value}});
          if(imei.equipmentId!==equipment.id)throw new DomainError(409,'IMEI de otro equipo.','IMEI_EQUIPMENT_CONFLICT');
          if(imei.registrationStatus!==null||await tx.registrationRequest.findFirst({where:{imeiId:imei.id,}}))throw new DomainError(409,'Este IMEI ya está registrado o tiene una solicitud vigente.','REQUEST_ALREADY_ACTIVE');
          const {value,mode,...fields}=item;const status=mode==='BLOCKED'?'BLOCKED':'PENDING';
          const request=await tx.registrationRequest.create({data:{...fields,referencePhone:item.referencePhone||item.phone,status,occurredAt:new Date(item.occurredAt),price:new Prisma.Decimal(item.price),operationId:operation.id,imeiId:imei.id,createdById:userId,updatedById:userId}});
          await helpers.updateRegistrationInTx(tx,value,{status,method:item.operator,ownerId:equipment.ownerId??undefined},true);
          await tx.registrationRequestHistory.create({data:{requestId:request.id,userId,action:'CREATED',metadata:{status}}});
          await audit(tx,'REGISTRATION_REQUEST_CREATED',request.id,{operationId:operation.id,status});
        }
        return replay(tx);
      }); }catch(error){
        if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002'){const previous=await replay(db);if(previous)return previous;}throw error;
      }
    },
    listRegistrationRequests:async(raw:unknown={})=>{
      const {q,status,equipmentId,clientId,limit,offset}=requestQuerySchema.parse(raw);
      return db.registrationRequest.findMany({where:{status,imei:{equipmentId,equipment:{ownerId:clientId}},...(q?{AND:q.split(/\s+/).map(term=>({OR:[{code:{contains:term,mode:'insensitive' as const}},{imei:{value:{contains:term}}},{imei:{equipment:{owner:{OR:[{dni:{contains:term}},{firstName:{contains:term,mode:'insensitive' as const}},{lastName:{contains:term,mode:'insensitive' as const}}]}}}}]}))}:{})},include:requestInclude,orderBy:[{createdAt:'desc'},{id:'asc'}],take:limit,skip:offset});
    },
    getRegistrationRequest:(id:unknown)=>detail(db,idSchema.parse(id)),
    updateRegistrationRequest:(id:unknown,raw:unknown)=>{
      const requestId=idSchema.parse(id),input=requestEditSchema.parse(raw),userId=actorId();
      return helpers.transaction(async tx=>{
        const found=await detail(tx,requestId);
        await tx.$queryRaw`SELECT id FROM "RegistrationRequest" WHERE id=${requestId}::uuid FOR UPDATE`;

        const snapshot={phone:found.phone,referencePhone:found.referencePhone,address:found.address,department:found.department,email:found.email,operator:found.operator,price:found.price.toFixed(2),hasBox:found.hasBox,occurredAt:found.occurredAt.toISOString()};
        const referencePhone=input.referencePhone===undefined?found.referencePhone||input.phone||found.phone:input.referencePhone||input.phone||found.phone;
        await tx.registrationRequest.update({where:{id:requestId},data:{...input,referencePhone,occurredAt:input.occurredAt?new Date(input.occurredAt):undefined,updatedById:userId}});
        await tx.registrationRequestHistory.create({data:{requestId,userId,action:'EDITED',metadata:{before:snapshot,changes:input}}});
        await audit(tx,'REGISTRATION_REQUEST_UPDATED',requestId,{fields:Object.keys(input)});
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
