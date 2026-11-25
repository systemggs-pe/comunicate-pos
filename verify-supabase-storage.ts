import {PrismaClient} from '@prisma/client';
import {S3EvidenceStorage,storageConfig} from './server/storage/s3.js';
const env=process.env;
Object.assign(env,{STORAGE_PROVIDER:'s3',S3_ENDPOINT:'https://vauttimgctjrikykaprp.storage.supabase.co/storage/v1/s3',S3_REGION:'us-west-2',S3_BUCKET:env.SUPABASE_STORAGE_BUCKET,S3_ACCESS_KEY_ID:env.SUPABASE_S3_ACCESS_KEY_ID,S3_SECRET_ACCESS_KEY:env.SUPABASE_S3_SECRET_ACCESS_KEY,S3_FORCE_PATH_STYLE:'true',S3_SERVER_SIDE_ENCRYPTION:'',S3_KMS_KEY_ID:''});
if(!env.DIRECT_URL)throw new Error('Falta DIRECT_URL.');
const db=new PrismaClient({datasources:{db:{url:env.DIRECT_URL}}});
const storage=new S3EvidenceStorage(storageConfig());
try {
 const rows=await db.evidenceAsset.findMany({select:{storageKey:true,originalStorageKey:true,status:true}});
 let valid=0,missing=0;
 for(const key of new Set(rows.flatMap(x=>[x.storageKey,x.originalStorageKey]).filter((x): x is string=>!!x))){
  if(!await storage.exists(key)){missing++;continue;}
  const {url}=await storage.authorizeDownload(key);
  const response=await fetch(url);
  if(!response.ok)throw new Error('Descarga firmada falló: '+response.status);
  await response.arrayBuffer();
  valid++;
 }
 console.log({signedDownloads:valid,missingReferences:missing});
}finally{await db.$disconnect();storage.client.destroy();}
