import { describe,it,expect } from 'vitest';
import { operationalRegistrationSchema,requestEditSchema,requestTransitionSchema,phoneSchema } from '../../shared/workflow';
import { accessorySchema,cents,decimalMoney,saleFlowSchema } from '../../shared/sales';
import { workflowInput } from '../helpers/workflow';
describe('Operación por IMEI y accesorios',()=>{
 it('registro doble, precio cero y snapshots válidos',()=>expect(operationalRegistrationSchema.parse(workflowInput()).requests).toHaveLength(2));
 it.each(['812345678','91234567','9123456789','9abcdefgh'])('rechaza celular %s',phone=>expect(phoneSchema.safeParse(phone).success).toBe(false));
 it('rechaza celulares iguales',()=>{const input=workflowInput();input.requests[1].phone=input.requests[0].phone;expect(operationalRegistrationSchema.safeParse(input).success).toBe(false);});
 it('rechaza solicitud de otro IMEI',()=>{const input=workflowInput();input.requests[0].value='359999999990001';expect(operationalRegistrationSchema.safeParse(input).success).toBe(false);});
 it.each(['address','department','email'] as const)('exige %s en atención',field=>{const input=workflowInput();input.requests[0][field]='';expect(operationalRegistrationSchema.safeParse(input).success).toBe(false);});
 it('edición genérica no altera identidad',()=>expect(requestEditSchema.safeParse({imeiId:crypto.randomUUID()}).success).toBe(false));
 it('transición exige confirmación y motivo',()=>{expect(requestTransitionSchema.safeParse({confirm:false,status:'COMPLETED',reason:'Prueba'}).success).toBe(false);});
 it.each([0,-1,1.5,10001])('cantidad inválida %i',quantity=>expect(accessorySchema.safeParse({name:'Cable',quantity,unitPrice:'0.10'}).success).toBe(false));
 it('total por cantidades exacto',()=>expect(decimalMoney(cents('3190')+2n*cents('0.10')+3n*cents('15.25')-cents('0.05'))).toBe('3235.90'));
 it('mantiene venta mínima con equipo',()=>expect(saleFlowSchema.safeParse({buyer:{client:workflowInput().client},items:[],accessories:[{name:'Cable',quantity:1,unitPrice:'1'}],paymentMethod:'CASH'}).success).toBe(false));
});
