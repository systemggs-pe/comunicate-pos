import type {S3Config} from '../storage/s3.js';
import {authorizedOrigins} from './security.js';
import {apiBase} from '../../shared/cloud.js';
export function cloudDatabaseConnection(raw:string|undefined,runtime:boolean){
 const url=new URL(raw??'');
 if(url.hostname.endsWith('.neon.tech'))return neonConnection(raw,runtime);
 const direct=/^db\.[a-z0-9]+\.supabase\.co$/.test(url.hostname);
 const session=/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname);
 if(!['postgres:','postgresql:'].includes(url.protocol)||(!direct&&!session)||(url.port&&url.port!=='5432')||!url.username||!url.password||url.pathname!=='/postgres'||url.hash)throw new Error('SUPABASE_CONNECTION_INVALID');
 const params=url.searchParams;
 if(['sslmode','sslaccept','connection_limit','pool_timeout','connect_timeout','pgbouncer'].some(key=>params.getAll(key).length>1)||params.get('sslmode')!=='require'||params.get('sslaccept')!=='strict'||params.has('pgbouncer'))throw new Error('SUPABASE_CONNECTION_INVALID');
 const bounded=(key:string)=>/^(?:[1-9]|[1-5][0-9]|60)$/.test(params.get(key)??'');
 if(runtime&&(!['1','2','3'].includes(params.get('connection_limit')??'')||!bounded('pool_timeout')||!bounded('connect_timeout')))throw new Error('SUPABASE_POOL_UNBOUNDED');
 return url;
}
export function neonConnection(raw:string|undefined,pooled:boolean){
 const url=new URL(raw??'');
 if(['sslmode','sslaccept','connection_limit','pool_timeout','connect_timeout'].some(key=>url.searchParams.getAll(key).length>1))throw new Error('NEON_AMBIGUOUS_PARAMETER');
 if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname.endsWith('.neon.tech')||!url.username||!url.password||url.searchParams.get('sslmode')!=='require'||url.searchParams.get('sslaccept')!=='strict'||!/^\/[a-zA-Z_][a-zA-Z0-9_]*$/.test(url.pathname)||url.hostname.includes('-pooler.')!==pooled)throw new Error('NEON_CONNECTION_INVALID');
 const timeout=(key:string)=>{const value=Number(url.searchParams.get(key));return Number.isInteger(value)&&value>=1&&value<=60;};
 if(pooled&&(!['1','2','3'].includes(url.searchParams.get('connection_limit')??'')||!timeout('pool_timeout')||!timeout('connect_timeout')))throw new Error('NEON_POOL_UNBOUNDED');
 return url;
}
export function b2Configuration(env:NodeJS.ProcessEnv):S3Config{
 const url=new URL(env.B2_ENDPOINT??'');
 if(url.protocol!=='https:'||!/^s3\.[a-z0-9-]+\.backblazeb2\.com$/.test(url.hostname)||url.port||url.pathname!=='/'||url.username||url.password||url.search||url.hash||!env.B2_BUCKET||!env.B2_ACCESS_KEY_ID||!env.B2_SECRET_ACCESS_KEY||!env.B2_REGION||url.hostname!==`s3.${env.B2_REGION}.backblazeb2.com`||env.B2_BUCKET===env.S3_BUCKET||env.B2_ACCESS_KEY_ID===env.S3_ACCESS_KEY_ID)throw new Error('B2_INDEPENDENT_PRIVATE_CONFIG_REQUIRED');
 return {endpoint:env.B2_ENDPOINT,region:env.B2_REGION,bucket:env.B2_BUCKET,accessKeyId:env.B2_ACCESS_KEY_ID,secretAccessKey:env.B2_SECRET_ACCESS_KEY,forcePathStyle:true,uploadTTL:60,downloadTTL:30};
}
export function sameSiteConfiguration(env:NodeJS.ProcessEnv){
 const api=new URL(apiBase(env.VITE_API_BASE_URL,true)),site=env.WEB_SITE_DOMAIN;
 const origins=authorizedOrigins(env.AUTH_ALLOWED_ORIGINS,true);
 // The operator must identify an owned registrable domain. This is a conservative
 // gate, not a public-suffix resolver or proof of domain ownership.
 if(!site||!/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(site)||['pages.dev','oraclecloud.com','co.uk','com.pe'].includes(site)||!api.hostname.endsWith(`.${site}`)||origins.some(origin=>!new URL(origin).hostname.endsWith(`.${site}`)))throw new Error('SAME_SITE_DOMAIN_REQUIRED');
 return true;
}
