import 'dotenv/config';
import {createBackup,restoreBackup} from '../server/ops/recovery.js';
import {S3EvidenceStorage,storageConfig} from '../server/storage/s3.js';
import {backupEstimate} from '../shared/cloud.js';
import {publishBackup,fetchBackup,retentionPlan,removeExpiredBackup,recordBackupStatus} from './lib/cloud-backups.js';
import {b2Configuration} from '../server/ops/cloud-configuration.js';
const mode=process.argv[2];
try{
 if(mode==='estimate'){const size=Number(process.env.BACKUP_ESTIMATED_COPY_BYTES);if(!Number.isSafeInteger(size)||size<=0)throw new Error('BACKUP_SIZE_MEASUREMENT_REQUIRED');console.log(JSON.stringify(backupEstimate(size,Number(process.env.BACKUP_ESTIMATED_COPIES??4))));}
 else{
  if(!process.argv.includes('--authorized-cloud'))throw new Error('CLOUD_ACTION_NOT_AUTHORIZED');
  const directory=process.env.BACKUP_DIRECTORY,password=process.env.BACKUP_PASSPHRASE;
  if(!directory||!password||password.length<32)throw new Error('BACKUP_CONFIGURATION_REQUIRED');
  if(mode==='create'||mode==='restore'){
   const storage=new S3EvidenceStorage({...storageConfig(),bucket:process.env.BACKUP_BUCKET||storageConfig().bucket});try{
    if(!process.env.BACKUP_DATABASE_URL)throw new Error('BACKUP_DATABASE_URL_REQUIRED');
    const result=mode==='create'?await createBackup({databaseUrl:process.env.BACKUP_DATABASE_URL,storage,directory,password,quiesced:process.argv.includes('--quiesced'),transport:'native-authorized',authorizedCloud:true}):await restoreBackup({databaseUrl:process.env.BACKUP_DATABASE_URL,storage,directory,password,confirmDatabase:process.env.RESTORE_CONFIRM_DATABASE??'',transport:'native-authorized',authorizedCloud:true});
    console.log(JSON.stringify({event:`backup.${mode}`,status:'SUCCESS',...result}));
   }finally{storage.client.destroy();}
  }else{
   const storage=new S3EvidenceStorage(b2Configuration(process.env));try{
    let result:Record<string,unknown>;
    if(mode==='upload')result=await publishBackup(storage,directory,password,Number(process.env.BACKUP_MAX_RETAINED_BYTES??8_000_000_000));
    else if(mode==='download')result=await fetchBackup(storage,process.env.BACKUP_ID??'',directory,password);
    else if(mode==='retention'){
     const expired=await retentionPlan(storage,Number(process.env.BACKUP_RETENTION_DAYS??3));
     const id=process.env.BACKUP_DELETE_ID;
     if(id){if(!expired.includes(id))throw new Error('BACKUP_NOT_EXPIRED_OR_LAST_COPY');result=await removeExpiredBackup(storage,id,process.env.BACKUP_DELETE_CONFIRM??'',Number(process.env.BACKUP_RETENTION_DAYS??3));}
     else result={dryRun:true,expired};
    }else throw new Error('BACKUP_MODE_INVALID');
    console.log(JSON.stringify({event:`backup.${mode}`,status:'SUCCESS',...result}));
    if(process.env.BACKUP_STATUS_FILE)await recordBackupStatus(process.env.BACKUP_STATUS_FILE,{status:'SUCCESS',mode,...result});
   }finally{storage.client.destroy();}
  }
 }
}catch{console.error(JSON.stringify({event:'backup.cloud',status:'FAILED',reason:'BACKUP_OPERATION_FAILED'}));if(process.env.BACKUP_STATUS_FILE)await recordBackupStatus(process.env.BACKUP_STATUS_FILE,{status:'FAILED',mode}).catch(()=>undefined);process.exitCode=1;}
