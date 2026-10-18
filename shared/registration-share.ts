interface ShareClient{dni:string;firstName:string;lastName:string;fullName?:string|null}
interface ShareRequest{id:string;operationId:string;imeiId:string;status:string;phone:string;address:string;department:string;email:string;hasBox:boolean;imei:{value:string;slot:number;equipmentId:string;equipment:{ownerId:string|null;owner:ShareClient|null;origin:string;imeis:{id:string;slot:number;value:string}[]}}}
const upper=(value:string|null|undefined)=>(value??'').toLocaleUpperCase('es-PE').replace(/[\r\n]+/g,' ').trim();
export function registrationShareText(target:ShareRequest,siblings:ShareRequest[]):string{
 const equipment=target.imei.equipment,client=equipment.owner;
 if(!client)throw new Error('El registro no tiene un cliente asociado.');
 const imei1=equipment.imeis.find(i=>i.slot===1)?.value??'',imei2=equipment.imeis.find(i=>i.slot===2)?.value??'';
 const same=siblings.filter(r=>r.operationId===target.operationId&&r.imei.equipmentId===target.imei.equipmentId&&r.imei.equipment.ownerId===equipment.ownerId);
 const ordered=[...same].sort((a,b)=>a.imei.slot-b.imei.slot);
 const double=target.status!=='BLOCKED'&&same.length===2&&new Set(same.map(r=>r.imeiId)).size===2&&ordered[0].imei.slot===1&&ordered[1].imei.slot===2&&same.some(r=>r.id===target.id)&&same.every(r=>r.status!=='BLOCKED'&&r.address===target.address&&r.department===target.department&&r.email===target.email&&r.hasBox===target.hasBox)&&ordered[0].phone!==ordered[1].phone;
 const blocked=target.status==='BLOCKED';
 const lines=[blocked?'DESBLOQUEO LISTA BLANCA':double?'REGISTRO DOBLE':'REGISTRO',`IMEI 1: ${imei1}`,`IMEI 2: ${imei2}`];
 if(blocked)lines.push(`TIPO: ${equipment.origin==='STORE'?'TIENDA':'EXTERNO'}`);
 lines.push(`TIENE CAJA: ${target.hasBox?'SI':'NO'}`,`DNI: ${client.dni}`);
 if(double)lines.push(`CELULAR 1: ${ordered[0].phone}`,`CELULAR 2: ${ordered[1].phone}`);else lines.push(`CELULAR: ${target.phone}`);
 lines.push(`NOMBRE CLIENTE: ${upper(client.fullName||[client.firstName,client.lastName].filter(Boolean).join(' '))}`,`DIRECCION: ${upper(target.address)} - ${upper(target.department)}`,`CORREO ELECTRONICO: ${upper(target.email)}`);
 if(!double)lines.push('',`IMEI A ${blocked?'DESBLOQUEAR':'REGISTRAR'}: ${target.imei.value}`);
 return lines.join('\n');
}
