import {PrismaClient} from '@prisma/client';
import {recoverSuperadmin} from '../server/ops/admin-recovery.js';

let db:PrismaClient|undefined;
try{
 const {RECOVERY_ADMIN_DATABASE_URL:url,RECOVERY_ADMIN_EMAIL:email,RECOVERY_ADMIN_NEW_PASSWORD:password}=process.env;
 if(!url||!email||!password)throw new Error('RECOVERY_CONFIGURATION_REQUIRED');
 const target=new URL(url);
 if(!['postgresql:','postgres:'].includes(target.protocol)||target.pathname.length<2)throw new Error('RECOVERY_INVALID_TARGET');
 db=new PrismaClient({datasources:{db:{url}}});
 const {revokedSessions}=await recoverSuperadmin(db,email,password);
 console.log(JSON.stringify({status:'SUCCESS',revokedSessions}));
}catch{
 console.error('No se pudo recuperar el acceso. Revisa el destino, la cuenta y la política de contraseña.');
 process.exitCode=1;
}finally{await db?.$disconnect();}
