import {authorizedOrigins} from './security.js';
export interface ConfigurationCheck {name:string;status:'PASS'|'FAIL'|'NOT VERIFIED'}
export function productionConfiguration(env:NodeJS.ProcessEnv):ConfigurationCheck[]{
 const checks:ConfigurationCheck[]=[];const check=(name:string,condition:boolean)=>checks.push({name,status:condition?'PASS':'FAIL'});
 check('production-mode',env.NODE_ENV==='production');try{authorizedOrigins(env.AUTH_ALLOWED_ORIGINS,true);check('https-exact-origins',true);}catch{check('https-exact-origins',false);}
 for(const name of ['DATABASE_URL','DIRECT_URL'] as const){try{const url=new URL(env[name]??'');check(`${name}-tls`,['postgres:','postgresql:'].includes(url.protocol)&&!['localhost','127.0.0.1'].includes(url.hostname)&&url.searchParams.get('sslmode')==='require'&&url.searchParams.get('sslaccept')==='strict'&&Boolean(url.username&&url.password)&&decodeURIComponent(url.password)!=='communicate_local');if(name==='DATABASE_URL')check('bounded-serverless-pool',url.searchParams.get('connection_limit')==='1'&&Number(url.searchParams.get('pool_timeout'))>0);}catch{check(`${name}-tls`,false);}}
 check('private-storage-config',env.STORAGE_PROVIDER==='s3'&&Boolean(env.S3_BUCKET&&env.S3_ACCESS_KEY_ID&&env.S3_SECRET_ACCESS_KEY)&&env.S3_ACCESS_KEY_ID!=='evidence_dev_admin');
 try{const url=new URL(env.S3_ENDPOINT??'https://s3.amazonaws.com');check('storage-https-endpoint',url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/');}catch{check('storage-https-endpoint',false);}
 check('storage-encryption-mode',['AES256','aws:kms'].includes(env.S3_SERVER_SIDE_ENCRYPTION??'')||env.S3_ENCRYPTION_PROVIDER==='r2-managed');
 check('kms-config-consistent',!env.S3_KMS_KEY_ID||env.S3_SERVER_SIDE_ENCRYPTION==='aws:kms');
 for(const name of ['S3_UPLOAD_URL_TTL_SECONDS','S3_DOWNLOAD_URL_TTL_SECONDS']){const ttl=Number(env[name]??(name.includes('UPLOAD')?60:30));check(`${name}-bounded`,Number.isInteger(ttl)&&ttl>=1&&ttl<=60);}
 check('real-dni-provider-config',env.DNI_PROVIDER==='api'&&Boolean(env.DNI_API_TOKEN));try{const url=new URL(env.DNI_API_URL??'');check('dni-https-endpoint',url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash);}catch{check('dni-https-endpoint',false);}
 check('bootstrap-credentials-removed',!env.ADMIN_PASSWORD);check('maintenance-disabled',env.MAINTENANCE_MODE!=='true');check('production-logging-enabled',env.HTTP_LOGGING!=='false');
 for(const name of ['production-db-connectivity-and-ca','private-bucket-policy-and-cors','production-encryption-evidence','production-backup-and-restore','signed-url-expiration-on-provider','cleanup-and-session-scheduler','dns-https-cookies-and-csp','real-dni-contract','physical-printing-48-80-a4','physical-mobile-camera','privacy-legal-review'])checks.push({name,status:'NOT VERIFIED'});
 return checks;
}
