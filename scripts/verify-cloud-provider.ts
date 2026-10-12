import 'dotenv/config';
import {PrismaClient} from '@prisma/client';
import {HeadBucketCommand} from '@aws-sdk/client-s3';
import {neonConnection,b2Configuration} from '../server/ops/cloud-configuration.js';
import {S3EvidenceStorage,storageConfig} from '../server/storage/s3.js';
// Phase10B read-only smoke. No writes, provisioning, migrations or token values.
if(!process.argv.includes('--authorized-isolated')){console.error(JSON.stringify({status:'BLOCKED',reason:'AUTHORIZED_ISOLATED_ENV_REQUIRED'}));process.exitCode=1;}
else{
 let db:PrismaClient|undefined,r2:S3EvidenceStorage|undefined,b2:S3EvidenceStorage|undefined;
 try{const url=neonConnection(process.env.DATABASE_URL,true);if(!/^\/communicate_pos_staging_[a-z0-9_]+$/.test(url.pathname))throw new Error('STAGING_REQUIRED');const config=storageConfig();if(!config.endpoint?.endsWith('.r2.cloudflarestorage.com')||!/^communicate-evidence-staging-[a-z0-9-]+$/.test(config.bucket))throw new Error('R2_STAGING_REQUIRED');const backupConfig=b2Configuration(process.env);if(!/^communicate-backups-staging-[a-z0-9-]+$/.test(backupConfig.bucket))throw new Error('B2_STAGING_REQUIRED');db=new PrismaClient({datasources:{db:{url:url.toString()}}});r2=new S3EvidenceStorage(config);b2=new S3EvidenceStorage(backupConfig);await db.$queryRaw`SELECT 1`;await r2.client.send(new HeadBucketCommand({Bucket:config.bucket}));await b2.client.send(new HeadBucketCommand({Bucket:backupConfig.bucket}));console.log(JSON.stringify({status:'PASS',mode:'read-only isolated',privatePoliciesAndEncryption:'NOT VERIFIED'}));}
 catch{console.error(JSON.stringify({status:'FAILED',reason:'ISOLATED_PROVIDER_SMOKE_FAILED'}));process.exitCode=1;}
 finally{await db?.$disconnect();r2?.client.destroy();b2?.client.destroy();}
}
