import { app } from './app.js';
import { prisma } from './db/prisma.js';
const server = app.listen(Number(process.env.PORT ?? 3001), '127.0.0.1', () => console.log('API local: http://127.0.0.1:3001/api/health'));
async function shutdown() { server.close(); await prisma.$disconnect(); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
