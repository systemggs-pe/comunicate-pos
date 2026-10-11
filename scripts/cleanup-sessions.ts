import 'dotenv/config';
import { prisma } from '../server/db/prisma.js';
import { createAuthService } from '../server/services/auth.service.js';
try { const result=await createAuthService(prisma).cleanup(); console.log(JSON.stringify({event:'sessions.cleanup',expiredSessions:result[0].count,expiredLimits:result[1].count})); } catch {console.error(JSON.stringify({event:'sessions.cleanup',status:'retry'}));process.exitCode=1;} finally { await prisma.$disconnect(); }
