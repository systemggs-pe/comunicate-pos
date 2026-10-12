import 'dotenv/config';
import {readFile,access,mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {publicEnvironment} from '../shared/cloud.js';
import {neonConnection,b2Configuration,sameSiteConfiguration} from '../server/ops/cloud-configuration.js';
const profile=process.argv.includes('--configured')?'configured':'local';
type Check={name:string;status:'PASS'|'FAIL'|'NOT VERIFIED'|'BLOCKED'};
const checks:Check[]=[];const check=(name:string,condition:boolean)=>checks.push({name,status:condition?'PASS':'FAIL'});
const docs=['architecture','free-tier-limits','oracle-deployment','neon-postgresql','cloudflare-pages','r2-storage','backblaze-backups','scheduled-worker','security','verification','manual-checklist'];
for(const path of [...docs.map(name=>`docs/phase-10a-${name}.md`),'public/_headers','public/_redirects','public/404.html','ops/oracle/Dockerfile','ops/oracle/install-template.sh','ops/oracle/communicate-api.service','ops/oracle/Caddyfile','ops/worker/communicate-worker.service','ops/worker/communicate-worker.timer','ops/backblaze/backup.env.example','scripts/verify-cloud-provider.ts','dist/index.html','dist/_headers','dist/_redirects','dist/404.html','dist/.vite/manifest.json','build-server/server/production.mjs','build-server/scripts/worker.mjs','build-server/scripts/cloud-backup.mjs','build-server/server/fonts/Lato-Light.ttf']){try{await access(path);check(path,true);}catch{check(path,false);}}
check('node-24-runtime',Number(process.versions.node.split('.')[0])===24);
const validation=spawnSync(process.execPath,['node_modules/prisma/build/index.js','validate'],{stdio:'pipe',windowsHide:true});check('prisma-valid',validation.status===0);
const migrationDiff=spawnSync('git',['diff','ddf3e32','--','prisma'],{encoding:'utf8',windowsHide:true});check('prisma-and-migrations-unchanged',migrationDiff.status===0&&!migrationDiff.stdout.trim());
const pkg=JSON.parse(await readFile('package.json','utf8')),production=await readFile('server/production.ts','utf8');check('no-startup-migrations',!production.includes('migrate')&&!pkg.scripts['build:api'].includes('migrate'));
try{publicEnvironment(Object.fromEntries(Object.entries(process.env).filter(([key])=>key.startsWith('VITE_'))),true);check('public-variable-allowlist',true);}catch{check('public-variable-allowlist',false);}
const tracked=spawnSync('git',['ls-files','-z'],{encoding:'utf8',windowsHide:true}).stdout.split('\0').filter(Boolean);check('no-tracked-private-env',!tracked.some(path=>/(^|\/)\.env($|\.)/.test(path)&&path!=='.env.example'));
let sourceSecret=false;for(const path of tracked.filter(p=>/\.(ts|tsx|js|mjs|json|md|sh|ya?ml|py)$/.test(p))){const text=await readFile(path,'utf8');if(/gh[pousr]_[a-zA-Z0-9]{36,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))sourceSecret=true;}check('no-known-source-secret-signatures',!sourceSecret);
const unit=await readFile('ops/oracle/communicate-api.service','utf8'),timer=await readFile('ops/worker/communicate-worker.timer','utf8');check('restricted-service-and-timer',unit.includes('User=communicate')&&unit.includes('ProtectSystem=strict')&&unit.includes('Restart=on-failure')&&timer.includes('OnUnitInactiveSec=15min'));
let leaked=false;const privateValues=['S3_SECRET_ACCESS_KEY','DNI_API_TOKEN','BACKUP_PASSPHRASE','B2_SECRET_ACCESS_KEY','ADMIN_PASSWORD'].map(k=>process.env[k]).filter((v):v is string=>!!v&&v.length>=8);
const manifest=JSON.parse(await readFile('dist/.vite/manifest.json','utf8'));for(const item of Object.values(manifest) as {file:string}[]){if(item.file.endsWith('.js')){const text=await readFile(`dist/${item.file}`,'utf8');if(privateValues.some(value=>text.includes(value)))leaked=true;}}
check('no-configured-secrets-in-bundle',!leaked);
for(const name of ['unit','integration','e2e','cloud-ui']){try{const report=JSON.parse(await readFile(`.test-results/phase10a/final-${name}.json`,'utf8'));check(`executed-${name}`,name==='e2e'?report.stats.expected>=44&&report.stats.unexpected===0&&report.stats.skipped===0:name==='cloud-ui'?report.status==='PASS':report.success===true&&report.numFailedTests===0&&report.numPendingTests===0);}catch{check(`executed-${name}`,false);}}
try{const arm=JSON.parse(await readFile('.test-results/phase10a/arm64.json','utf8'));check('isolated-arm64-smoke',arm.status==='PASS'&&arm.architecture==='arm64');}catch{checks.push({name:'isolated-arm64-smoke',status:'NOT VERIFIED'});}
if(profile==='configured'){
 for(const [name,run] of [['neon-pooled',()=>neonConnection(process.env.DATABASE_URL,true)],['neon-direct',()=>neonConnection(process.env.DIRECT_URL,false)],['b2-independent',()=>b2Configuration(process.env)],['same-site-cookies',()=>sameSiteConfiguration(process.env)]] as const){try{run();check(name,true);}catch{check(name,false);}}
 check('r2-config',process.env.S3_REGION==='auto'&&process.env.S3_ENCRYPTION_PROVIDER==='r2-managed'&&!process.env.S3_SERVER_SIDE_ENCRYPTION&&!process.env.S3_KMS_KEY_ID&&!!process.env.S3_ENDPOINT&&/^https:\/\/[a-f0-9]{32}\.r2\.cloudflarestorage\.com\/?$/.test(process.env.S3_ENDPOINT));
 check('worker-pool-declared',!!process.env.WORKER_DATABASE_URL);
 check('production-security-mode',process.env.NODE_ENV==='production'&&process.env.TRUST_LOOPBACK_PROXY==='true'&&process.env.HTTP_LOGGING!=='false'&&!process.env.ADMIN_PASSWORD&&process.env.MAINTENANCE_MODE!=='true');
 check('backup-encryption-key-configured',(process.env.BACKUP_PASSPHRASE?.length??0)>=32);
}
for(const name of ['oracle-free-capacity-and-service','owned-domain-and-https-cookies','neon-remote-connectivity','r2-private-policy-cors-encryption','b2-private-transfer-retention-restore','scheduled-worker-and-alerts','provider-billing-caps','physical-print-camera-dni'])checks.push({name,status:'NOT VERIFIED'});
if(profile==='configured')checks.push({name:'cloud-verification-before-release',status:'BLOCKED'});
const result={profile,checks,localPreparation:checks.some(c=>c.status==='FAIL')?'FAIL':'PASS',cloudVerification:'NOT VERIFIED',productionReadiness:'NO',readOnly:true,externalConnections:false};await mkdir('.test-results/phase10a',{recursive:true});await writeFile(`.test-results/phase10a/preflight-${profile}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(checks.some(c=>c.status==='FAIL'||c.status==='BLOCKED'))process.exitCode=1;
