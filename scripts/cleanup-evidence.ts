import 'dotenv/config';
import {prisma} from '../server/db/prisma.js';
import {cleanupEvidence} from '../server/evidence/lifecycle.js';
try{const result=await cleanupEvidence(prisma);console.log(JSON.stringify({deleted:result.deleted,pending:result.pending.length}));if(result.pending.length)process.exitCode=2;}finally{await prisma.$disconnect();}
