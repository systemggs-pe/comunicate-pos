import {build} from 'esbuild';
import {mkdir,cp} from 'node:fs/promises';
await build({entryPoints:{'server/production':'server/production.ts','scripts/worker':'scripts/worker.ts','scripts/cloud-backup':'scripts/cloud-backup.ts','scripts/arm-smoke':'scripts/arm-smoke.ts'},outdir:'build-server',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',target:'node24',packages:'external',sourcemap:false});
for(const directory of ['server','scripts']){await mkdir(`build-server/${directory}/fonts`,{recursive:true});await cp('server/documents/fonts',`build-server/${directory}/fonts`,{recursive:true});}
