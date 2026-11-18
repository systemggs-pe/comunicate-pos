/** Deterministic synthetic test data only; never repair user-supplied identifiers. */
export function fixtureImei(seed:number):string{
 if(!Number.isSafeInteger(seed)||seed<0||seed>=100000000000000)throw new Error('Synthetic IMEI seed must fit 14 digits');
 const base=String(seed).padStart(14,'0');
 const sum=[...base].reduce((total,char,index)=>{const digit=Number(char)*(index%2?2:1);return total+Math.floor(digit/10)+digit%10;},0);
 return base+String((10-sum%10)%10);
}
