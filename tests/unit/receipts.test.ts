import {it,expect} from 'vitest';
import {companySchema,companyDefaults,type CompanySettings} from '../../shared/company';
import {receiptRows,receiptBarcode,receiptLayout,type ReceiptData} from '../../shared/receipt';
import {createReceiptPdf} from '../../src/features/receipts/pdf';
it('AUD-09 effective settings change contact and geometry; legacy preferences cannot alter the approved ticket',()=>{
 const legacy={...sample,company:{...sample.company,receiptFooter:'UNUSED FOOTER',showSeller:false,showSerial:false,showClientContact:false,businessType:'UNUSED TYPE',email:'unused@example.test'}};
 expect(receiptRows(legacy,58)).toEqual(receiptRows(sample,58));
 const effective={...sample,company:{...sample.company,address:'AV. PRUEBA 2',city:'LOCAL PRUEBA',phone:'900000003',margin58:4,margin80:3}};
 const text=receiptRows(effective,58).map(r=>r.text).join('\n');
 for(const field of ['AV. PRUEBA 2','LOCAL PRUEBA','Tel. 900000003'])expect(text).toContain(field);
 expect(receiptLayout(effective,58).width).toBe(50);expect(receiptLayout(effective,80).width).toBe(74);
});
export const sample:ReceiptData={company:{...companyDefaults,id:1,updatedAt:'2026-10-10T12:00:00Z',updatedById:null} as CompanySettings,sale:{id:'test',code:'SALE-000123',buyerId:'client',buyer:{id:'client',code:'CL-1',dni:'12345678',firstName:'Ana',lastName:'Muñoz',phone:'912345678',email:null,createdAt:'',updatedAt:''},total:'100.15',subtotal:'100.20',discount:'0.05',paymentMethod:'YAPE',notes:null,createdAt:'2026-10-10T12:00:00Z',createdBy:{id:'actor',name:'Admin'},equipment:[{id:'line',unitPrice:'100.00',equipment:{id:'e',code:'EQ-1',ownerId:null,owner:null,origin:'STORE',status:'ACTIVE',brand:'Samsung',model:'A10',color:'Azul',ram:'8GB',storage:'128GB',serialNumber:'AbC123',createdAt:'',registrationStatus:'NOT_REGISTERED',imeis:[{id:'i1',equipmentId:'e',slot:1,value:'597087654300116',type:'PHYSICAL',registrationStatus:null,registrationMethod:null,registeredAt:null,registrationStartedAt:null},{id:'i2',equipmentId:'e',slot:2,value:'597087654300124',type:'ESIM',registrationStatus:null,registrationMethod:null,registeredAt:null,registrationStartedAt:null}]}}],accessories:[{name:'Cable',quantity:2,unitPrice:'0.10'}]}};
it('valida empresa, normaliza texto y correo, rechaza formatos no admitidos',()=>{expect(companySchema.parse({...companyDefaults,businessName:'comunicáte',email:'ADMIN@EXAMPLE.TEST'})).toMatchObject({businessName:'COMUNICÁTE',email:'admin@example.test'});for(const defaultFormat of [48,72])expect(companySchema.safeParse({...companyDefaults,defaultFormat}).success).toBe(false);expect(companySchema.safeParse({...companyDefaults,margin58:6}).success).toBe(false);});
it.each([58,80] as const)('%i mm conserva la plantilla, los IMEI y el total exacto',format=>{
 const rows=receiptRows(sample,format),text=rows.map(r=>r.text).join('\n');
 for(const value of ['COMUNIC@TE','RECIBO DE VENTA','VEN-000123','597087654300116','597087654300124','ANA MUÑOZ','AbC123'])expect(text).toContain(value);
 expect(rows.find(r=>r.kind==='total')?.right).toBe('S/. 100.15');
 expect(rows.find(r=>r.text==='CABLE X 2')?.right).toBe('S/. 0.20');
 expect(rows.some(r=>r.label==='Nombre:'&&r.text==='ANA MUÑOZ')).toBe(true);
 expect(text).not.toContain('ATENDIDO');expect(text).not.toContain('DESCUENTO');
});
it('58 y 80 adaptan la geometría sin cambiar el contenido aprobado',()=>{
 const small=receiptLayout(sample,58),large=receiptLayout(sample,80);
 expect(small.width).toBe(52);expect(large.width).toBe(76);expect(large.height).toBeGreaterThan(small.height);
 expect(receiptRows(sample,58)).toEqual(receiptRows(sample,80));
});
it('barcode CODE128 conserva módulos y zonas de silencio legibles',()=>{const a=receiptBarcode('SALE-000123',78)!;expect(a.bits).toMatch(/^110100/);expect(a.bits).toMatch(/1100011101011$/);expect(a.width).toBe(78);expect(a.module).toBeGreaterThanOrEqual(.25);expect(a.quiet).toBeGreaterThanOrEqual(2.5);expect(receiptBarcode('S'.repeat(100),46)).toBeNull();expect(receiptBarcode('Á',78)).toBeNull();});
it.each([58,80] as const)('PDF %i mm conserva ancho físico y alto variable',format=>{const doc=createReceiptPdf(sample,format);expect(doc.internal.pageSize.getWidth()).toBeCloseTo(format,2);expect(doc.internal.pageSize.getHeight()).toBeGreaterThan(100);expect(doc.output()).toContain('%PDF-');expect(doc.getNumberOfPages()).toBe(1);const more=createReceiptPdf({...sample,sale:{...sample.sale,equipment:[...sample.sale.equipment!,...sample.sale.equipment!]}},format);expect(more.internal.pageSize.getHeight()).toBeGreaterThan(doc.internal.pageSize.getHeight());});
it.each([58,80] as const)('PDF largo %i mm pagina sin cambiar el ancho de papel',format=>{const doc=createReceiptPdf({...sample,sale:{...sample.sale,equipment:Array.from({length:50},()=>sample.sale.equipment![0])}},format);expect(doc.getNumberOfPages()).toBeGreaterThan(1);expect(doc.internal.pageSize.getWidth()).toBeCloseTo(format,2);expect(doc.internal.pageSize.getHeight()).toBeLessThanOrEqual(1000);});
it.each([58,80] as const)('ticket %i usa fullName sin alterar los datos del cliente',format=>{const data={...sample,sale:{...sample.sale,buyerPhone:'923456789',buyer:{...sample.sale.buyer,firstName:'',lastName:'',fullName:'NOMBRE COMPLETO SINTÉTICO'}}};const rows=receiptRows(data,format);expect(rows.find(r=>r.label==='Nombre:')?.text).toBe('NOMBRE COMPLETO SINTÉTICO');expect(rows.find(r=>r.label==='DNI:')?.text).toBe('12345678');expect(sample.sale.buyer.phone).toBe('912345678');});
