import argon2 from 'argon2';
import sharp from 'sharp';
import {PrismaClient} from '@prisma/client';
import {createDeclarationPdf} from '../server/documents/declaration.pdf.js';
import {encryptBackup,decryptBackup} from '../server/ops/recovery.js';
const password='synthetic-arm64-smoke-password-only';
if(!await argon2.verify(await argon2.hash(password),password))throw new Error('ARGON2_FAILED');
const image=await sharp({create:{width:16,height:16,channels:3,background:'#ffffff'}}).webp().toBuffer();if(!image.length)throw new Error('SHARP_FAILED');
const pdf=createDeclarationPdf({requestId:'00000000-0000-4000-8000-000000000001',code:'RECO-999001',fingerprint:'a'.repeat(64),applicantName:'PERSONA FICTICIA DE PRUEBA',documentType:'DNI',clientDocument:'12345678',address:'DIRECCIÓN FICTICIA 123',phone:'912345678',brand:'SAMSUNG',model:'S25',imei:'359708765430001',date:'10/10/2026',agentName:'AGENTE FICTICIO DE PRUEBA',agentDocument:'87654321'});if(!pdf.output('arraybuffer').byteLength)throw new Error('PDF_FAILED');
if(!decryptBackup(encryptBackup(Buffer.from('synthetic'),password),password).equals(Buffer.from('synthetic')))throw new Error('CRYPTO_FAILED');
const target=new URL(process.env.DATABASE_URL??'');if(target.hostname!=='127.0.0.1'||target.port!=='9')throw new Error('SYNTHETIC_OFFLINE_TARGET_REQUIRED');
const db=new PrismaClient();try{await db.$connect();throw new Error('OFFLINE_TARGET_UNEXPECTEDLY_CONNECTED');}catch(error){const e=error as {code?:string;errorCode?:string;name?:string;message?:string};if((e.code??e.errorCode)!=='P1001'&&!(e.name==='PrismaClientInitializationError'&&e.message?.includes('127.0.0.1:9')&&e.message.includes("Can't reach database server")))throw error;}finally{await db.$disconnect();}
console.log(JSON.stringify({status:'PASS',platform:process.platform,architecture:process.arch,node:process.version,argon2:true,sharp:true,pdf:true,crypto:true,prismaEngine:true,cloudConnectivity:'NOT VERIFIED'}));
