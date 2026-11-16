import 'dotenv/config';
import {readFile} from 'node:fs/promises';
import {PrismaClient} from '@prisma/client';
import {importForeignReceipts} from '../server/services/foreign-receipts-import.js';

const [file,...options]=process.argv.slice(2);
if(!file||options.length>1||options.some(option=>option!=='--apply')){
 throw new Error('Uso: npx tsx scripts/import-foreign-receipts.ts exportacion.json [--apply]');
}
const db=new PrismaClient();
try{
 const input=JSON.parse(await readFile(file,'utf8'));
 console.log(JSON.stringify(await importForeignReceipts(db,input,options.includes('--apply')),null,2));
}finally{await db.$disconnect();}
