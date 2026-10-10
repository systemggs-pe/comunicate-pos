import { app } from './app.js';
import { prisma } from './db/prisma.js';
import {cleanupEvidence} from './evidence/lifecycle.js';
const port = Number(process.env.PORT ?? 3001);
const server = app.listen(port, '127.0.0.1', () => console.log(`API local: http://127.0.0.1:${port}/api/health`));
let cleaning=false;
const cleanupTimer=setInterval(()=>{if(cleaning)return;cleaning=true;void cleanupEvidence(prisma).catch(()=>console.error('EVIDENCE_CLEANUP_RETRY')).finally(()=>{cleaning=false;});},60000);
cleanupTimer.unref();
async function shutdown() { clearInterval(cleanupTimer);server.close(); await prisma.$disconnect(); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
