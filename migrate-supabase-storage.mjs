import {createHash} from 'node:crypto';
import {S3Client,ListObjectsV2Command,GetObjectCommand,PutObjectCommand} from '@aws-sdk/client-s3';

const env=process.env;
const bucket=env.S3_BUCKET;
const targetBucket=env.SUPABASE_STORAGE_BUCKET;
const endpoint='https://vauttimgctjrikykaprp.storage.supabase.co/storage/v1/s3';
if(!targetBucket||!env.SUPABASE_S3_ACCESS_KEY_ID||!env.SUPABASE_S3_SECRET_ACCESS_KEY)throw new Error('Faltan el bucket privado y las credenciales S3 de Supabase.');
const config={forcePathStyle:true,requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'};
const local=new S3Client({...config,endpoint:env.S3_ENDPOINT,region:env.S3_REGION??'us-east-1',credentials:{accessKeyId:env.S3_ACCESS_KEY_ID,secretAccessKey:env.S3_SECRET_ACCESS_KEY}});
const remote=new S3Client({...config,endpoint,region:'us-west-2',credentials:{accessKeyId:env.SUPABASE_S3_ACCESS_KEY_ID,secretAccessKey:env.SUPABASE_S3_SECRET_ACCESS_KEY}});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
let objects=0,bytes=0,continuation;
try {
 do {
  const listing=await local.send(new ListObjectsV2Command({Bucket:bucket,ContinuationToken:continuation}));
  for(const {Key} of listing.Contents??[]){
   const original=await local.send(new GetObjectCommand({Bucket:bucket,Key}));
   const body=await original.Body.transformToByteArray();
   const input={Bucket:targetBucket,Key};
   let prior=await remote.send(new GetObjectCommand(input)).catch(error=>{
    if(error.$metadata?.httpStatusCode===404)return null;
    throw error;
   });
   if(!prior){
    await remote.send(new PutObjectCommand({...input,Body:body,ContentType:original.ContentType,CacheControl:'private, no-store',Metadata:original.Metadata}));
    prior=await remote.send(new GetObjectCommand(input));
   }
   if(hash(await prior.Body.transformToByteArray())!==hash(body))throw new Error('El destino contiene un objeto distinto con la misma clave.');
   objects++;
   bytes+=body.byteLength;
  }
  continuation=listing.NextContinuationToken;
 }while(continuation);
 console.log({objects,bytes,verified:true});
}finally{local.destroy();remote.destroy();}
