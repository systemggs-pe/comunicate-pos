import {spawn} from 'node:child_process';
import {createReadStream,createWriteStream,mkdirSync} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {resolve} from 'node:path';

const url=new URL(process.env.DIRECT_URL??'');
if(url.hostname!=='aws-1-us-west-2.pooler.supabase.com'||url.username!=='postgres.vauttimgctjrikykaprp'||url.port!=='5432')throw new Error('Destino inesperado.');
const cert='/tmp/communicate-supabase-ca.crt';
const targetEnv={...process.env,PGHOST:url.hostname,PGPORT:url.port,PGUSER:url.username,PGDATABASE:'postgres',PGPASSWORD:decodeURIComponent(url.password),PGSSLMODE:'verify-full',PGSSLROOTCERT:cert};
const flags=['PGHOST','PGPORT','PGUSER','PGDATABASE','PGPASSWORD','PGSSLMODE','PGSSLROOTCERT'].flatMap(key=>['-e',key]);
function docker(args, options={}){
 const child=spawn('docker',['compose',...args],{stdio:['pipe','pipe','inherit'],...options});
 const done=new Promise((yes,no)=>{child.once('error',no);child.once('close',code=>code===0?yes():no(new Error('Docker/PostgreSQL exit '+code)));});
 return {child,done};
}
const path=resolve('.env.supabase-backup','pos-'+Date.now()+'.dump');
mkdirSync(resolve('.env.supabase-backup'),{recursive:true});
const dump=docker(['exec','-T','postgres','pg_dump','-U','communicate','-d','communicate_pos','--schema=public','--format=custom','--no-owner','--no-privileges']);
await Promise.all([dump.done,pipeline(dump.child.stdout,createWriteStream(path,{flags:'wx'}))]);
console.log('Respaldo local: '+path);
await docker(['cp','supabase-ca.crt','postgres:'+cert],{stdio:'inherit'}).done;
const check=docker(['exec','-T',...flags,'postgres','psql','-XAt','-v','ON_ERROR_STOP=1','-c',"SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"],{env:targetEnv});
let status=''; for await (const chunk of check.child.stdout) status+=chunk;
await check.done;
if(status.trim()!=='0')throw new Error('El esquema remoto public contiene tablas. Se detuvo la importación.');
const archive='/tmp/communicate-pos-'+Date.now()+'.dump';
const list=archive+'.list';
await docker(['cp',path,'postgres:'+archive],{stdio:'inherit'}).done;
await docker(['exec','-T','postgres','sh','-c',`pg_restore -l ${archive} | sed '/ SCHEMA - public /d' > ${list}`],{stdio:'inherit'}).done;
const restore=docker(['exec','-T',...flags,'postgres','pg_restore','--dbname=postgres','--single-transaction','--exit-on-error','--no-owner','--no-privileges','--use-list='+list,archive],{env:targetEnv});
restore.child.stdout.resume();
try { await restore.done; } finally { await docker(['exec','-T','postgres','rm','-f',archive,list]).done; }
console.log('Restauración completa.');
