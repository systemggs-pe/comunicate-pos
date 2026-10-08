import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
// Una instancia por proceso, también en invocaciones calientes de serverless.
globalForPrisma.prisma = prisma;
