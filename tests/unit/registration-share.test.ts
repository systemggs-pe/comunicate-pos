import {expect,it} from 'vitest';
import {registrationShareText} from '../../shared/registration-share';
const equipment={ownerId:'client',owner:{dni:'70000001',firstName:'ANA',lastName:'PÉREZ'},origin:'EXTERNAL',imeis:[{id:'i1',slot:1,value:'356938035643809'},{id:'i2',slot:2,value:'490154203237518'}]};
const first={id:'r1',operationId:'op',imeiId:'i1',status:'PENDING',phone:'900000001',address:'AV. PRUEBA 1',province:'TACNA',department:'LIMA',email:'test@example.test',hasBox:true,imei:{...equipment.imeis[0],equipmentId:'e',equipment}};
const second={...first,id:'r2',imeiId:'i2',phone:'900000002',imei:{...equipment.imeis[1],equipmentId:'e',equipment}};
it.each(['PENDING','REGISTERED','BLOCKED'])('AUD-06 %s shares province rather than department',status=>{
 const text=registrationShareText({...first,status},[]);expect(text).toContain('DIRECCION: AV. PRUEBA 1 - TACNA');expect(text).not.toContain('LIMA');expect(text).toContain(status==='BLOCKED'?'DESBLOQUEO LISTA BLANCA':'REGISTRO');
});
it('AUD-06 double uses province and orders phone/IMEI pairs',()=>{const text=registrationShareText(second,[second,first]);expect(text).toContain('REGISTRO DOBLE');expect(text).toContain('CELULAR 1: 900000001\nCELULAR 2: 900000002');expect(text).toContain('DIRECCION: AV. PRUEBA 1 - TACNA');});
it.each(['OTRA PROVINCIA',null,undefined,''])('AUD-06 incompatible province %s prevents double grouping',province=>{expect(registrationShareText(first,[first,{...second,province}])).not.toContain('REGISTRO DOBLE');});
it('AUD-06 missing historical province does not substitute the department or invent a value',()=>{const text=registrationShareText({...first,province:null},[]);expect(text).toContain('DIRECCION: AV. PRUEBA 1\n');expect(text).not.toContain('LIMA');});
it('AUD-06 province normalization and same missing legacy values remain compatible',()=>{expect(registrationShareText(first,[first,{...second,province:' tacna '}])).toContain('REGISTRO DOBLE');expect(registrationShareText({...first,province:null},[{...first,province:null},{...second,province:undefined}])).toContain('REGISTRO DOBLE');});
