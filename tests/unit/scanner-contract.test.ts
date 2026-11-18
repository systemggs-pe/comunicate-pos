import {it,expect} from 'vitest';
import {scanFields,validateDetection,mergeDetection} from '../../shared/scanner';
const blank=()=>Object.fromEntries(scanFields.map(k=>[k,null]));
it.each(['brand','commercialName','model','color','ram','storage','serialNumber'])('valida %s vacío, ilegible y con controles sin afectar otros campos',field=>{
 for(const value of ['', 'a'.repeat(101),'TEXT\u0001']){const result=validateDetection({...blank(),brand:'SAMSUNG',[field]:value});expect(result.data[field as keyof typeof result.data]).toBeNull();expect(result.warnings).toContain(field);}
});
it.each(['imei1','imei2'])('rechaza caracteres dudosos, números y longitud inválida en %s',field=>{
 for(const value of ['12345678901234','1234567890123456','O12345678901234','123 456789012345']){const result=validateDetection({...blank(),[field]:value});expect(result.data[field as 'imei1'|'imei2']).toBe(value);expect(result.warnings).toContain(field);}
 expect(()=>validateDetection({...blank(),[field]:123456789012345})).toThrow();
});
it('rechaza respuestas incompletas, arrays, null y campos ajenos',()=>{for(const raw of [{brand:'SAMSUNG'},[],null,{...blank(),dni:'00000001'}])expect(()=>validateDetection(raw)).toThrow();});
it('respuesta completamente ilegible no vacía datos existentes',()=>{
 const current=Object.fromEntries(scanFields.map(k=>[k,k==='brand'?'MANUAL':''])) as Record<typeof scanFields[number],string>;
 const result=mergeDetection(current,validateDetection(blank()).data,{},{});expect(result.merged).toEqual(current);
});
it('modelo, marca, nombre, capacidad y serial permanecen independientes',()=>{
 const raw={...blank(),brand:' SAMSUNG ',commercialName:'GALAXY S25 ULTRA',model:'SM-S938B/DS',color:'GRAY',ram:'12 GB',storage:'256 GB',serialNumber:'R58TEST',imei1:'123456789012347',imei2:'123456789012354'};
 const {data}=validateDetection(raw);expect(data).toEqual({...raw,brand:'SAMSUNG'});
});
