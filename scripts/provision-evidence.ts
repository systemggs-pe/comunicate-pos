import 'dotenv/config';
import {CreateBucketCommand,HeadBucketCommand,DeleteBucketPolicyCommand} from '@aws-sdk/client-s3';
import {S3EvidenceStorage,storageConfig} from '../server/storage/s3.js';
const endpoint=new URL(process.env.S3_ENDPOINT??'');
if(!['localhost','127.0.0.1'].includes(endpoint.hostname)||process.env.NODE_ENV==='production')throw new Error('SOLO APROVISIONAMIENTO LOCAL; NO SE MODIFICARON BUCKETS PRODUCTIVOS.');
for(const bucket of [process.env.S3_BUCKET,'communicate-evidence-test']){
 if(!bucket)throw new Error('CONFIGURA S3_BUCKET.');
 const provider=new S3EvidenceStorage({...storageConfig(),bucket});
 try{await provider.client.send(new HeadBucketCommand({Bucket:bucket}));}catch(error){if((error as {$metadata?:{httpStatusCode?:number}}).$metadata?.httpStatusCode!==404)throw error;await provider.client.send(new CreateBucketCommand({Bucket:bucket}));}
 await provider.client.send(new DeleteBucketPolicyCommand({Bucket:bucket}));
 // MinIO CE uses cluster CORS (MINIO_API_CORS_ALLOW_ORIGIN in Compose).
 // Production S3/R2 bucket CORS is configured by its operator, never this script.
 console.log(`BUCKET LOCAL PRIVADO PREPARADO: ${bucket}`);
 provider.client.destroy();
}
