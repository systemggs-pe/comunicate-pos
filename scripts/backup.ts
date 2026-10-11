import 'dotenv/config';
import {createBackup,restoreBackup} from '../server/ops/recovery.js';
import {S3EvidenceStorage,storageConfig} from '../server/storage/s3.js';
const mode=process.argv[2],databaseUrl=process.env.BACKUP_DATABASE_URL,directory=process.env.BACKUP_DIRECTORY,password=process.env.BACKUP_PASSPHRASE,bucket=process.env.BACKUP_BUCKET;
if(!databaseUrl||!directory||!password||!bucket)throw new Error('BACKUP_EXPLICIT_CONFIGURATION_REQUIRED');
const storage=new S3EvidenceStorage({...storageConfig(),bucket});
try{const options={databaseUrl,directory,password,storage};const result=mode==='create'?await createBackup({...options,quiesced:process.argv.includes('--confirm-quiesced')}):mode==='restore'?await restoreBackup({...options,confirmDatabase:process.env.RESTORE_CONFIRM_DATABASE??''}):(()=>{throw new Error('BACKUP_MODE_INVALID');})();console.log(JSON.stringify({status:'PASS',...result}));}catch{console.error('BACKUP_OPERATION_FAILED; revisión requerida, no se sobrescribieron recursos existentes.');process.exitCode=1;}finally{storage.client.destroy();}
