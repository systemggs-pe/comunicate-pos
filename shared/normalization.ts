export function normalizeTypedText(value:string):string{return value.normalize('NFC').toLocaleUpperCase('es-PE');}
export function normalizeText(value: string): string { return value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleUpperCase('es-PE'); }
export function normalizeEmail(value: string): string { return value.trim().normalize('NFC').toLowerCase(); }
const textKeys=new Set(['fullName','firstName','lastName','name','brand','model','commercialName','color','ram','storage','address','department','notes','conditions']);
export function normalizeOperationalResponse(value:unknown):unknown {
 if(Array.isArray(value))return value.map(normalizeOperationalResponse);
 if(value&&typeof value==='object'&&'fullName' in value&&typeof value.fullName==='string'&&'dni' in value&&'firstName' in value){value={...value,firstName:value.fullName,lastName:''};}
 if(value&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype)return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,typeof item==='string'&&textKeys.has(key)?normalizeText(item):normalizeOperationalResponse(item)]));
 return value;
}
