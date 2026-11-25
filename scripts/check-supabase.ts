import {PrismaClient} from '@prisma/client';
import {cloudDatabaseConnection} from '../server/ops/cloud-configuration.js';

async function main() {
 const url=cloudDatabaseConnection(process.env.DIRECT_URL,false);
 const project=process.env.SUPABASE_PROJECT_REF;
 if(!project||(!url.hostname.startsWith(`db.${project}.`)&&!url.username.endsWith(`.${project}`)))throw new Error('SUPABASE_PROJECT_MISMATCH');
 const db=new PrismaClient({datasources:{db:{url:url.toString()}}});
 try {
  const [state]=await db.$queryRaw<{database:string;hasPosSchema:boolean}[]>`
   SELECT current_database() AS database, to_regclass('public."Client"') IS NOT NULL AS "hasPosSchema"
  `;
  console.log(JSON.stringify({connected:true,...state}));
 } finally {
  await db.$disconnect();
 }
}

main().catch((error:unknown)=>{
 const code=typeof error==='object'&&error!==null&&('errorCode' in error?error.errorCode:'code' in error?error.code:null);
 if(typeof code==='string'&&/^P\d{4}$/.test(code))console.error(`Prisma: ${code}`);
 if(error instanceof Error){
  if(/^SUPABASE_[A-Z_]+$/.test(error.message))console.error(error.message);
  else if(/certificate|TLS|SSL/i.test(error.message)){
   const detail=error.message.match(/0x[0-9a-f]{8}|CERT_[A-Z_]+|SEC_E_[A-Z_]+|unable to get local issuer certificate|certificate verify failed|native-certs|revocation/gi);
   console.error('Fallo de TLS o certificado.',detail?.join(', ')??'');
  }
  else if(/authentication|password|credentials/i.test(error.message))console.error('Fallo de autenticación.');
  else if(/tenant or user not found/i.test(error.message))console.error('El pooler no reconoce el proyecto o usuario.');
  else console.error(error.name);
 }
 console.error('No se pudo verificar la conexión. Revisa el proyecto, la contraseña y el Session Pooler con TLS estricto.');
 process.exitCode=1;
});
