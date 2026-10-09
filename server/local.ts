import { app } from './app.js';
import { prisma } from './db/prisma.js';
const port = Number(process.env.PORT ?? 3001);
const server = app.listen(port, '127.0.0.1', () => console.log(`API local: http://127.0.0.1:${port}/api/health`));
async function shutdown() { server.close(); await prisma.$disconnect(); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
