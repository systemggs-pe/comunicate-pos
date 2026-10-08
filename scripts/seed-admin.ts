import 'dotenv/config';
import { prisma } from '../server/db/prisma.js';
import { createAuthService } from '../server/services/auth.service.js';
try {
  const {ADMIN_NAME,ADMIN_EMAIL,ADMIN_PASSWORD}=process.env;
  if(!ADMIN_NAME||!ADMIN_EMAIL||!ADMIN_PASSWORD) throw new Error('Define ADMIN_NAME, ADMIN_EMAIL y ADMIN_PASSWORD en el entorno privado.');
  const result=await createAuthService(prisma).bootstrap({name:ADMIN_NAME,email:ADMIN_EMAIL,password:ADMIN_PASSWORD});
  console.log(result.created ? 'SUPERADMIN creado. No se muestran credenciales.' : 'Ya existe un SUPERADMIN activo. No se modificó ninguna cuenta.');
} catch { console.error('Bootstrap no completado. Revisa variables, política, correo y migraciones; no se sobrescriben cuentas.'); process.exitCode=1; }
finally { await prisma.$disconnect(); }
