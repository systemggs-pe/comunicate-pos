import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { prisma } from '../server/db/prisma.js';
import { createAuthService } from '../server/services/auth.service.js';

try {
  const database = new URL(process.env.DATABASE_URL ?? '');
  if (!['127.0.0.1', 'localhost'].includes(database.hostname) || database.port !== '55432' || database.pathname !== '/communicate_pos') {
    throw new Error('Se requiere la base local communicate_pos.');
  }
  const active = await prisma.user.findFirst({ where: { status: 'ACTIVE', role: { code: 'SUPERADMIN' } } });
  if (active) {
    console.log('Administrador existente: ingresa con tu cuenta habitual.');
  } else {
    const name = process.env.ADMIN_NAME || 'Administrador local';
    const email = process.env.ADMIN_EMAIL || 'admin@comunicate.local';
    const password = process.env.ADMIN_PASSWORD || randomBytes(18).toString('base64url');
    const result = await createAuthService(prisma).bootstrap({ name, email, password });
    if (result.created) {
      writeFileSync('.local-admin.txt', `Acceso exclusivo para desarrollo local\nURL: http://127.0.0.1:5173\nCorreo: ${email}\nContraseña: ${password}\n`, { mode: 0o600 });
      console.log('Administrador local creado. Consulta tus credenciales en .local-admin.txt (excluido de Git).');
    }
  }
} catch {
  console.error('No se pudo preparar el administrador local. Revisa las migraciones y las variables ADMIN_*; las cuentas existentes se conservan.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
