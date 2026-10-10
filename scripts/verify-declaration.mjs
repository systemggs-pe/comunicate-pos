import {spawnSync} from 'node:child_process';
const pdf='.test-results/phase6b/declaration-test.pdf';
function run(command,args){const result=spawnSync(command,args,{encoding:'utf8',windowsHide:true});if(result.error||result.status!==0){process.stderr.write(result.stderr??'');throw new Error(result.error?.message??`PDF verification failed (${result.status})`);}return result.stdout;}
run(process.execPath,['node_modules/tsx/dist/cli.mjs','scripts/create-declaration-test-pdf.ts']);
const python=process.env.PDF_TEST_PYTHON??'python';
const parsed=JSON.parse(run(python,['scripts/inspect-declaration-pdf.py',pdf]));
console.log(`PDF válido: ${parsed.pages} página A4; fuentes ${parsed.fonts.join(', ')}.`);
console.log(`Comparación de datos personales del original: ${process.env.DECLARATION_REFERENCE_PDF?'verificada':'requiere DECLARATION_REFERENCE_PDF'}.`);
const args=['scripts/verify-declaration-visual.py',pdf];
if(process.env.DECLARATION_REFERENCE_PDF)args.push('--reference',process.env.DECLARATION_REFERENCE_PDF);
process.stdout.write(run(python,args));
