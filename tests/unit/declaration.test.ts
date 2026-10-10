import {it,expect} from 'vitest';
import {createDeclarationPdf} from '../../server/documents/declaration.pdf';
import {declarationConfirmationSchema} from '../../shared/declaration';
import {updateUserSchema} from '../../shared/auth';
import {declarationFixture} from '../helpers/declaration';
import {inspectDeclarationPdf} from '../helpers/declaration-pdf';
import layout from '../../shared/declaration-layout.json';
it('PDF dinámico válido, una página A4 exacta, texto literal y datos exclusivos',()=>{
 const data=declarationFixture,doc=createDeclarationPdf(data),parsed=inspectDeclarationPdf(Buffer.from(doc.output('arraybuffer')));
 expect(parsed.pages).toBe(1);expect(parsed.width/72*25.4).toBeCloseTo(210,5);expect(parsed.height/72*25.4).toBeCloseTo(297,5);
 for(const literal of ['DECLARACIÓN JURADA DE INGRESO DE EQUIPO ADQUIRIDO EN EL EXTRANJERO','Por el presente documento, yo','identificado(a) con documento de identidad (DNI, Carné de Extranjería, Pasaporte, otro especificar)','con domicilio en','(Línea a ser vinculada al equipo terminal móvil adquirido en el extranjero), declaro:','ingresado legalmente al país para mi uso personal.','- Que dicho equipo cuenta con IMEI válido, habiéndose realizado satisfactoriamente la validación por el Concesionario Móvil que me brinda el servicio público móvil.','- Que tengo pleno conocimiento que solo puedo ingresar y registrar hasta cinco (5) equipos adquiridos en el extranjero a mi nombre por año. En ese sentido, el sexto equipo ingresado al país y registrado a mi nombre ante cualquier Concesionario Móvil, será bloqueado.','Fecha (dd/mm/aaaa): 10/10/2026','Firma y huella de Solicitante','Firma de Agente','Nombre y apellidos:','Número de Documento de Identidad:'])expect(parsed.text).toContain(literal);
 for(const value of [data.applicantName,data.clientDocument,data.address,data.phone,data.brand,data.model,data.imei,data.agentName,data.agentDocument])expect(parsed.text).toContain(value);
 expect(parsed.text.match(/\b\d{15}\b/g)).toEqual([data.imei]);expect(parsed.text).not.toContain(data.code);expect(parsed.fonts.every(f=>f.includes('Lato'))).toBe(true);
 expect(layout.words.filter(w=>w.bold).every(w=>w.size===13)).toBe(true);expect(new Set(layout.words.filter(w=>!w.bold).map(w=>w.size))).toEqual(new Set([9,10]));
});
it.each(['operatorConfirmed','applicantConfirmed','regulatoryReviewed'])('exige confirmación explícita %s',key=>{
 const data={fingerprint:'a'.repeat(64),operatorConfirmed:true,applicantConfirmed:true,regulatoryReviewed:true};
 expect(declarationConfirmationSchema.safeParse({...data,[key]:false}).success).toBe(false);
 expect(declarationConfirmationSchema.safeParse({...data,[key]:undefined}).success).toBe(false);
 expect(declarationConfirmationSchema.safeParse({...data,agentDocument:'12345678'}).success).toBe(false);
 expect(declarationConfirmationSchema.safeParse(data).success).toBe(true);
});
it('bloquea desbordamientos sin truncar, omitir campos ni crear otra página',()=>{
 expect(()=>createDeclarationPdf({...declarationFixture,applicantName:'NOMBRE '.repeat(40)})).toThrow('NO CABE');
 expect(()=>createDeclarationPdf({...declarationFixture,address:''})).toThrow('NO CABE');
});
it('DNI del agente opcional al migrar, validado al editar sin inventar valores',()=>{
 expect(updateUserSchema.parse({identityDocument:null}).identityDocument).toBeNull();
 expect(updateUserSchema.parse({identityDocument:'87654321'}).identityDocument).toBe('87654321');
 for(const identityDocument of ['123','123456789','abcdefgh'])expect(updateUserSchema.safeParse({identityDocument}).success).toBe(false);
});
