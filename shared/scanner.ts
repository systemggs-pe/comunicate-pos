import {z} from 'zod';
import {imeiValueSchema} from './validation.js';
export const scanFields=['brand','commercialName','model','color','ram','storage','imei1','imei2','serialNumber'] as const;
export type ScanField=typeof scanFields[number];
export const boxScanSchema=z.object(Object.fromEntries(scanFields.map(k=>[k,z.string().nullable()])) as Record<ScanField,z.ZodNullable<z.ZodString>>).strict();
export type BoxScan=z.infer<typeof boxScanSchema>;
export function validateDetection(raw:unknown){
 const parsed=boxScanSchema.parse(raw),warnings:ScanField[]=[],data={...parsed};
 for(const key of scanFields){const v=data[key];if(v===null)continue;if(!v.trim()||v.length>100||Array.from(v).some(char=>char.charCodeAt(0)<32)||(key.startsWith('imei')&&(!/^\d{15}$/.test(v)||!imeiValueSchema.safeParse(v).success))){data[key]=null;warnings.push(key);}else if(!key.startsWith('imei'))data[key]=v.trim().replace(/\s+/g,' ');}
 if(data.imei1&&data.imei1===data.imei2){data.imei2=null;warnings.push('imei2');}
 return {data,warnings};
}
export function mergeDetection(current:Record<ScanField,string>,data:BoxScan,versions:Partial<Record<ScanField,number>>,baseline:Partial<Record<ScanField,number>>){
 const merged={...current},conflicts:ScanField[]=[];
 for(const key of scanFields){const value=data[key];if(value===null)continue;if(current[key]||versions[key]!==baseline[key]){if(current[key]!==value)conflicts.push(key);}else merged[key]=value;}
 if(merged.imei1&&merged.imei1===merged.imei2){merged.imei2=current.imei2;conflicts.push('imei2');}
 return {merged,conflicts:[...new Set(conflicts)]};
}
