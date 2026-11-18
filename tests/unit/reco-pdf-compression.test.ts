import {expect,it} from 'vitest';
import {PDFDocument,PDFPage, StandardFonts} from 'pdf-lib';
import {compressRecoPdf,recoPdfByteLimit} from '../../server/documents/reco-pdf-compression';
import {createEvidencePdf,type EvidencePdfData} from '../../server/documents/evidence.pdf';

const data:EvidencePdfData={businessName:'POS',code:'RECO-PRUEBA',date:'',client:'',dni:'',equipment:'',brand:'',imei:'',operator:'MOVISTAR',status:'',responsible:'',photos:[]};

async function declaration(){
 const doc=await PDFDocument.create();
 const font=await doc.embedFont(StandardFonts.Helvetica);
 for(const size of [[595,842],[612,792]] as [number,number][]){
  doc.addPage(size).drawText('Declaracion de prueba',{x:40,y:700,font});
 }
 return Buffer.from(await doc.save());
}
const generate=async()=>compressRecoPdf(data,createEvidencePdf(data),new Map(),await declaration());
const size=(page:PDFPage)=>page.getSize();

it('combina la declaración y el RECO sin pérdida cuando el archivo ya cabe',async()=>{
 const packet=await generate();
 expect(packet.bytes.length).toBe(packet.originalSize);
 expect(packet.bytes.length).toBeLessThan(recoPdfByteLimit);
 const result=await PDFDocument.load(packet.bytes);
 expect(result.getPages().map(size)).toEqual([{width:595,height:842},{width:612,height:792},{width:595.28,height:841.89},{width:595.28,height:841.89}]);
});

it.each([399_999,400_000,400_001])('aplica el límite estricto a un RECO válido de %i bytes',async targetSize=>{
 const reco=createEvidencePdf({...data,operator:'CLARO'});
 const trailer=reco.lastIndexOf('startxref');
 const comment=Buffer.alloc(targetSize-reco.length,32);
 comment[0]=37;
 comment[comment.length-1]=10;
 const original=Buffer.concat([reco.subarray(0,trailer),comment,reco.subarray(trailer)]);
 expect((await PDFDocument.load(original)).getPageCount()).toBe(2);
 const packet=await compressRecoPdf({...data,operator:'CLARO'},original,new Map());
 expect(packet.originalSize).toBe(targetSize);
 expect(packet.bytes.length).toBeLessThan(recoPdfByteLimit);
 if(targetSize===399_999)expect(packet.bytes).toBe(original);
 else expect((await PDFDocument.load(packet.bytes)).getPageCount()).toBe(2);
});

it('un archivo imposible de comprimir devuelve el error recuperable',async()=>{
 const document=await PDFDocument.create();
 const page=document.addPage();
 const vector=document.context.stream(`q\n${'0 0 m 40 40 l S\n'.repeat(30_000)}Q\n`);
 page.node.addContentStream(document.context.register(vector));
 const source=Buffer.from(await document.save());
 expect(source.length).toBeGreaterThan(400_000);
 await expect(compressRecoPdf(data,createEvidencePdf(data),new Map(),source)).rejects.toMatchObject({
  code:'EVIDENCE_PDF_MOVISTAR_SIZE',message:'No se pudo generar un PDF legible de menos de 400 KB'
 });
 await expect(generate()).resolves.toBeDefined();
});
