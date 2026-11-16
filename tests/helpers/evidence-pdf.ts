import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
export function inspectEvidencePdf(bytes:Buffer){
 mkdirSync('.test-results/registration-pdf',{recursive:true});const path=`.test-results/registration-pdf/${randomUUID()}.pdf`;writeFileSync(path,bytes);
 const result=spawnSync(process.env.PDF_TEST_PYTHON??'python',['scripts/inspect-evidence-pdf.py',path],{encoding:'utf8'});if(result.status!==0)throw Error(`Evidence PDF parser: ${result.error?.message??result.stderr}`);
 return JSON.parse(result.stdout) as {text:string;pages:{text:string;images:{width:number;height:number;x:number;y:number;drawWidth:number;drawHeight:number}[]}[]};
}
