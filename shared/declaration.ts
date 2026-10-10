import {z} from 'zod';
export interface DeclarationData {
 requestId:string;code:string;fingerprint:string;
 applicantName:string;documentType:'DNI';clientDocument:string;address:string;phone:string;
 brand:string;model:string;imei:string;date:string;agentName:string;agentDocument:string;
}
export const declarationConfirmationSchema=z.object({fingerprint:z.string().regex(/^[a-f0-9]{64}$/),operatorConfirmed:z.literal(true),applicantConfirmed:z.literal(true),regulatoryReviewed:z.literal(true)}).strict();
export interface DeclarationOutput {pdfBase64:string;fileName:string}
