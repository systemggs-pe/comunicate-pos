import {z} from 'zod';
import {activeForeignReceiptFormat,foreignReceiptDevice,foreignReceiptLocalDateTime} from './foreign-receipts.js';
import {idSchema} from './validation.js';

export const registrationReceiptChoice=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('FOREIGN'),id:idSchema,version:z.iso.datetime({offset:true})}).strict(),
 z.object({kind:z.literal('STORED'),id:idSchema}).strict(),
 z.object({kind:z.literal('SALE'),format:activeForeignReceiptFormat}).strict(),
 z.object({kind:z.literal('MANUAL'),format:activeForeignReceiptFormat,issuedAt:foreignReceiptLocalDateTime,price:foreignReceiptDevice.shape.price}).strict(),
]);
export type RegistrationReceiptChoice=z.output<typeof registrationReceiptChoice>;
export type ReceiptCandidate={kind:'FOREIGN';id:string;version:string;folio:number;issuer:string;date:string;format:number;needsReview:boolean}
 |{kind:'STORED';id:string;date:string;originalPdf:boolean};
export type RegistrationReceiptOptions={
 candidates:ReceiptCandidate[];
 sold:boolean;
 sale:{code:string;purchaseAt:string;issuedAt:string;price:string}|null;
 formats:number[];
};
