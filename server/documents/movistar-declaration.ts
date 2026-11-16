import {movistarDeclarationInvalid} from '../../shared/evidence.js';
import {DomainError} from '../lib/errors.js';

export async function validateMovistarDeclaration(bytes:Buffer){
 const invalid=()=>new DomainError(400,movistarDeclarationInvalid,'MOVISTAR_DECLARATION_INVALID');
 if(!bytes.subarray(0,5).equals(Buffer.from('%PDF-'))||!bytes.toString('latin1').trimEnd().endsWith('%%EOF'))throw invalid();
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const task=getDocument({data:new Uint8Array(bytes),stopAtErrors:true,enableXfa:false});
 try{
  const document=await task.promise;
  if(!document.numPages)throw invalid();
  for(let page=1;page<=document.numPages;page++)await document.getPage(page);
 }catch{throw invalid();}
 finally{await task.destroy();}
}
