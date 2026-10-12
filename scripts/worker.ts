import 'dotenv/config';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {prisma} from '../server/db/prisma.js';
import {createEvidenceStorage} from '../server/storage/s3.js';
import {runWorker} from '../server/ops/worker.js';
const controller=new AbortController();const stop=()=>controller.abort();process.once('SIGTERM',stop);process.once('SIGINT',stop);
try {
 if(!process.env.WORKER_DATABASE_URL)throw new Error('WORKER_DATABASE_URL_REQUIRED');
 const storage=createEvidenceStorage();try{
  const result=await runWorker(prisma,storage,{lockUrl:process.env.WORKER_DATABASE_URL,batchSize:Number(process.env.WORKER_BATCH_SIZE??25),maxBatches:Number(process.env.WORKER_MAX_BATCHES??2),timeoutMs:Number(process.env.WORKER_TIMEOUT_MS??90000),signal:controller.signal,maintenance:process.env.MAINTENANCE_MODE==='true'});
  const path=process.env.WORKER_STATUS_FILE;if(path){await mkdir(dirname(path),{recursive:true});await writeFile(`${path}.tmp`,JSON.stringify(result),{mode:0o600});await rename(`${path}.tmp`,path);}
  console.log(JSON.stringify({event:'worker.completed',...result}));if(result.status==='FAILED')process.exitCode=1;else if(result.status==='PARTIAL')process.exitCode=2;
 }finally{storage.client.destroy();}
}catch{console.error(JSON.stringify({event:'worker.completed',status:'FAILED',reason:'WORKER_CONFIGURATION_OR_IO'}));process.exitCode=1;}
finally{await prisma.$disconnect();process.off('SIGTERM',stop);process.off('SIGINT',stop);}
