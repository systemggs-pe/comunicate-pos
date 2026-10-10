import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
export function inspectDeclarationPdf(bytes:Buffer){
 mkdirSync('.test-results/phase6b',{recursive:true});
 const path=`.test-results/phase6b/${randomUUID()}.pdf`;
 writeFileSync(path,bytes);
 const result=spawnSync(process.env.PDF_TEST_PYTHON??'python',['scripts/inspect-declaration-pdf.py',path],{encoding:'utf8'});
 if(result.status!==0)throw new Error(`PDF parser failed: ${result.error?.message??result.stderr}`);
 return JSON.parse(result.stdout) as {text:string;pages:number;width:number;height:number;fonts:string[]};
}
