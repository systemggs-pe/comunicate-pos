import 'dotenv/config';
import {PrismaClient} from '@prisma/client';
import sharp from 'sharp';
import express from 'express';
import {createApp} from '../../server/app';
import {CodartProvider} from '../../server/integrations/codart';
import {DomainError} from '../../server/lib/errors';
import {scanFields} from '../../shared/scanner';
const target=new URL(process.env.DATABASE_URL!);
if(target.pathname!=='/communicate_pos_test'||!['127.0.0.1','localhost'].includes(target.hostname)||process.env.PORT!=='3002')throw Error('ISOLATED MVP TEST SERVER ONLY');
const db=new PrismaClient();
let control={scanner:'ok',delay:0,nameDelay:0,photo:'ok',nameCalls:0,photoCalls:0,scanCalls:0};
process.env.CODART_ENABLED='true';process.env.CODART_PHOTO_STORAGE_AUTHORIZED='true';
const png=await sharp({create:{width:120,height:180,channels:3,background:'#123456'}}).png().toBuffer();
const jpeg=await sharp({create:{width:180,height:120,channels:3,background:'#654321'}}).jpeg().toBuffer();
const fetcher:typeof fetch=async(input)=>{
 const url=String(input);if(!url.startsWith('https://api-codart.cgrt.org/'))throw Error('MOCK CONTRACT URL');
 if(url.includes('/reniec/')){control.nameCalls++;await new Promise(r=>setTimeout(r,control.nameDelay));return Response.json({success:true,result:{full_name:'CLIENTE SINTÉTICO DE PRUEBA',address:'NEVER IMPORT',birth_date:'NEVER IMPORT'}});}
 control.photoCalls++;if(control.photo==='credits')return Response.json({}, {status:402});
 return Response.json({success:true,data:{images:[{data_uri:'data:image/png;base64,'+png.toString('base64')},{data_uri:'data:image/jpeg;base64,'+jpeg.toString('base64')}]},credits_deducted:2});
};
const provider=new CodartProvider('synthetic-test-token',fetcher);
const app=createApp(db,{dniProvider:provider,identityPhotos:provider,boxScanner:{simulated:true,scan:async(bytes)=>{
 control.scanCalls++;const mode=control.scanner,delay=control.delay;await new Promise(r=>setTimeout(r,delay));
 if(mode==='error')throw new DomainError(503,'FALLO SIMULADO DEL ESCÁNER. CONTINÚA MANUALMENTE.','SCANNER_UNAVAILABLE');
 if(mode==='quota')throw new DomainError(429,'CUOTA SIMULADA AGOTADA.','EXTERNAL_QUOTA_REACHED');
 if(mode==='invalid')return {brand:5};
 const stats=await sharp(bytes).stats(),red=stats.channels[0].mean>150;
 return {...Object.fromEntries(scanFields.map(k=>[k,null])),brand:'SAMSUNG',commercialName:'GALAXY DE PRUEBA',model:red?'MOCK-A':'MOCK-B',color:'AZUL',ram:'12 GB',storage:'256 GB',serialNumber:'MOCK-SERIAL',imei1:red?'359708765431001':'359708765432001',imei2:red?'359708765431002':'359708765432002'};
}}});
const harness=express();
harness.get('/api/_test/control',(_req,res)=>res.json({...control,simulated:true}));
harness.post('/api/_test/control',express.json(),(req,res)=>{control={...control,...req.body};res.json({simulated:true});});
harness.use(app);
const server=harness.listen(3002,'127.0.0.1',()=>console.log('MVP provider harness: SIMULATED; isolated DB only'));
async function stop(){server.close();await db.$disconnect();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
