import {createHash} from 'node:crypto';
import {Prisma,type PrismaClient} from '@prisma/client';
import {idSchema} from '../../shared/validation.js';
import {declarationConfirmationSchema,type DeclarationData} from '../../shared/declaration.js';
import {normalizeText} from '../../shared/normalization.js';
import {DomainError} from '../lib/errors.js';
import {writeAudit,type AuditContext} from '../lib/audit.js';
import type {Db} from '../repositories/pos.repository.js';
import {createDeclarationPdf} from '../documents/declaration.pdf.js';
export function createDeclarationService(db:PrismaClient,ctx:AuditContext){
 async function load(tx:Db,raw:unknown):Promise<DeclarationData>{
  const id=idSchema.parse(raw),request=await tx.registrationRequest.findUnique({where:{id},include:{imei:{include:{equipment:{include:{owner:true}}}}}});
  if(!request)throw new DomainError(404,'SOLICITUD NO ENCONTRADA.','REQUEST_NOT_FOUND');
  const imei=request.imei,equipment=imei.equipment,client=equipment.owner;
  if(imei.equipmentId!==equipment.id||request.imeiId!==imei.id||!client||client.id!==equipment.ownerId)throw new DomainError(409,'REVISA LA RELACIÓN SOLICITUD, IMEI, EQUIPO Y CLIENTE.','DECLARATION_RELATION_INVALID');
  const agent=await tx.user.findUnique({where:{id:ctx.userId},select:{id:true,name:true,identityDocument:true,status:true}});
  if(!agent||agent.status!=='ACTIVE'||!agent.name.trim()||!agent.identityDocument)throw new DomainError(422,'COMPLETA EL NOMBRE Y DNI DEL USUARIO AGENTE EN USUARIOS ANTES DE GENERAR LA DECLARACIÓN.','AGENT_IDENTITY_REQUIRED');
  const fields={requestId:id,code:request.code,applicantName:normalizeText(client.firstName+' '+client.lastName),documentType:'DNI' as const,clientDocument:client.dni,address:request.address,phone:request.phone,brand:equipment.brand,model:equipment.model,imei:imei.value,date:new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',day:'2-digit',month:'2-digit',year:'numeric'}).format(request.occurredAt),agentName:normalizeText(agent.name),agentDocument:agent.identityDocument};
  if(!fields.address.trim()||!fields.brand.trim()||!fields.model.trim()||!/^\d{8}$/.test(fields.clientDocument)||!/^9\d{8}$/.test(fields.phone)||!/^\d{15}$/.test(fields.imei))throw new DomainError(422,'FALTAN DATOS OBLIGATORIOS DE LA SOLICITUD.','DECLARATION_DATA_REQUIRED');
  return {...fields,fingerprint:createHash('sha256').update(JSON.stringify({...fields,agentId:agent.id,updatedAt:request.updatedAt})).digest('hex')};
 }
 return {
  data:(id:unknown)=>load(db,id),
  generate:async(id:unknown,raw:unknown)=>{const confirmations=declarationConfirmationSchema.parse(raw);return db.$transaction(async tx=>{
   const data=await load(tx,id);if(data.fingerprint!==confirmations.fingerprint)throw new DomainError(409,'LOS DATOS CAMBIARON. REVISA Y CONFIRMA NUEVAMENTE.','DECLARATION_DATA_CHANGED');
   const bytes=Buffer.from(createDeclarationPdf(data).output('arraybuffer'));
   await writeAudit(tx,ctx,'DECLARATION_GENERATED','RegistrationRequest',data.requestId,{template:'PHASE_6B_A4_V1',imeiId:(await tx.registrationRequest.findUniqueOrThrow({where:{id:data.requestId},select:{imeiId:true}})).imeiId,operatorConfirmed:true,applicantConfirmed:true,regulatoryReviewed:true,fingerprint:data.fingerprint});
   return {pdfBase64:bytes.toString('base64'),fileName:`${data.code}.pdf`};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});},
 };
}
