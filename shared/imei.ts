export const imeiMessages={
 format:'IMEI INVÁLIDO: USA SOLO DÍGITOS DEL 0 AL 9.',
 length:'IMEI: DEBE TENER EXACTAMENTE 15 DÍGITOS.',
 checksum:'IMEI INVÁLIDO: NO CUMPLE EL ALGORITMO DE LUHN.',
 valid:'IMEI VÁLIDO.',
} as const;
export type ImeiValidationCode='INVALID_IMEI_FORMAT'|'INVALID_IMEI_LENGTH'|'INVALID_IMEI_CHECKSUM';
/** Full 15-character IMEI; strings preserve leading zeroes. Never repair a checksum. */
export function isValidImeiLuhn(imei:string):boolean{
 if(typeof imei!=='string'||!/^[0-9]{15}$/.test(imei))return false;
 let sum=0,double=false;
 for(let index=imei.length-1;index>=0;index--){
  let digit=imei.charCodeAt(index)-48;
  if(double){digit*=2;if(digit>9)digit-=9;}
  sum+=digit;double=!double;
 }
 return sum%10===0;
}
export function imeiValidationError(imei:unknown):{code:ImeiValidationCode;message:string}|null{
 if(typeof imei!=='string'||!/^[0-9]*$/.test(imei))return {code:'INVALID_IMEI_FORMAT',message:imeiMessages.format};
 if(imei.length!==15)return {code:'INVALID_IMEI_LENGTH',message:imeiMessages.length};
 return isValidImeiLuhn(imei)?null:{code:'INVALID_IMEI_CHECKSUM',message:imeiMessages.checksum};
}
