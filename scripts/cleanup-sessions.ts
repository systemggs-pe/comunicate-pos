import 'dotenv/config';
import { prisma } from '../server/db/prisma.js';
import { createAuthService } from '../server/services/auth.service.js';
try { const result=await createAuthService(prisma).cleanup(); console.log({expiredSessions:result[0].count,expiredLimits:result[1].count}); } finally { await prisma.$disconnect(); }
