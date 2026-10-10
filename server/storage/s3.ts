import {S3Client,PutObjectCommand,GetObjectCommand,HeadObjectCommand,DeleteObjectCommand} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {DomainError} from '../lib/errors.js';
import type {EvidenceStorageProvider} from './provider.js';
export interface S3Config {endpoint?:string;region:string;bucket:string;accessKeyId:string;secretAccessKey:string;forcePathStyle:boolean;uploadTTL:number;downloadTTL:number;encryption?:'AES256'|'aws:kms'}
export function storageConfig():S3Config{
 const env=process.env;if(env.STORAGE_PROVIDER!=='s3'||!env.S3_BUCKET||!env.S3_ACCESS_KEY_ID||!env.S3_SECRET_ACCESS_KEY)throw new DomainError(503,'ALMACENAMIENTO PRIVADO NO CONFIGURADO.','STORAGE_NOT_CONFIGURED');
 if(env.S3_ENDPOINT){const url=new URL(env.S3_ENDPOINT);if(url.protocol!=='https:'&&!(env.NODE_ENV!=='production'&&['127.0.0.1','localhost'].includes(url.hostname)))throw new DomainError(503,'EL STORAGE REQUIERE HTTPS FUERA DEL DESARROLLO LOCAL.','STORAGE_NOT_CONFIGURED');}
 const ttl=(raw:string|undefined,fallback:number)=>Math.max(1,Math.min(60,Number(raw)||fallback));
 return {endpoint:env.S3_ENDPOINT||undefined,region:env.S3_REGION||'us-east-1',bucket:env.S3_BUCKET,accessKeyId:env.S3_ACCESS_KEY_ID,secretAccessKey:env.S3_SECRET_ACCESS_KEY,forcePathStyle:env.S3_FORCE_PATH_STYLE==='true',uploadTTL:ttl(env.S3_UPLOAD_URL_TTL_SECONDS,60),downloadTTL:ttl(env.S3_DOWNLOAD_URL_TTL_SECONDS,30),encryption:['AES256','aws:kms'].includes(env.S3_SERVER_SIDE_ENCRYPTION??'')?env.S3_SERVER_SIDE_ENCRYPTION as S3Config['encryption']:undefined};
}
export class S3EvidenceStorage implements EvidenceStorageProvider {
 readonly client:S3Client;
 constructor(readonly config:S3Config){this.client=new S3Client({region:config.region,endpoint:config.endpoint,forcePathStyle:config.forcePathStyle,credentials:{accessKeyId:config.accessKeyId,secretAccessKey:config.secretAccessKey},requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED',maxAttempts:2});}
 async upload(key:string,bytes:Buffer){await this.client.send(new PutObjectCommand({Bucket:this.config.bucket,Key:key,Body:bytes,ContentType:'image/webp',CacheControl:'private, no-store, max-age=0',ServerSideEncryption:this.config.encryption}));}
 async download(key:string,maxBytes:number){const head=await this.client.send(new HeadObjectCommand({Bucket:this.config.bucket,Key:key}));if(!head.ContentLength||head.ContentLength>maxBytes)throw new DomainError(400,'LA IMAGEN EXCEDE EL LÍMITE PERMITIDO.','EVIDENCE_SIZE_INVALID');const result=await this.client.send(new GetObjectCommand({Bucket:this.config.bucket,Key:key}));const chunks:Buffer[]=[];let size=0;if(!result.Body)throw new Error('EMPTY_STORAGE_BODY');for await(const chunk of result.Body as AsyncIterable<Uint8Array>){size+=chunk.length;if(size>maxBytes)throw new DomainError(400,'LA IMAGEN EXCEDE EL LÍMITE PERMITIDO.','EVIDENCE_SIZE_INVALID');chunks.push(Buffer.from(chunk));}return Buffer.concat(chunks);}
 async delete(key:string){await this.client.send(new DeleteObjectCommand({Bucket:this.config.bucket,Key:key}));}
 async exists(key:string){try{await this.client.send(new HeadObjectCommand({Bucket:this.config.bucket,Key:key}));return true;}catch(e){if((e as {$metadata?:{httpStatusCode?:number}}).$metadata?.httpStatusCode===404)return false;throw e;}}
 async authorizeUpload(key:string,mimeType:string,size:number){const command=new PutObjectCommand({Bucket:this.config.bucket,Key:key,ContentType:mimeType,ContentLength:size});return {url:await getSignedUrl(this.client,command,{expiresIn:this.config.uploadTTL,signableHeaders:new Set(['content-type','content-length'])}),headers:{'Content-Type':mimeType},expiresIn:this.config.uploadTTL};}
 async authorizeDownload(key:string,fileName?:string){return {url:await getSignedUrl(this.client,new GetObjectCommand({Bucket:this.config.bucket,Key:key,ResponseCacheControl:'private, no-store, max-age=0',ResponseContentDisposition:fileName?`attachment; filename="${fileName}"`:'inline'}),{expiresIn:this.config.downloadTTL}),expiresIn:this.config.downloadTTL};}
}
export const createEvidenceStorage=()=>new S3EvidenceStorage(storageConfig());
