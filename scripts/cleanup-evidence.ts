import 'dotenv/config';
import {prisma} from '../server/db/prisma.js';
import {cleanupEvidence} from '../server/evidence/lifecycle.js';
try{const result=await cleanupEvidence(prisma);console.log(JSON.stringify({event:'evidence.cleanup',deleted:result.deleted,pending:result.pending.length}));if(result.pending.length)process.exitCode=2;}catch{console.error(JSON.stringify({event:'evidence.cleanup',status:'retry'}));process.exitCode=1;}finally{await prisma.$disconnect();}
