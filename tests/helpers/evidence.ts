import type {PrismaClient} from '@prisma/client';
import {S3EvidenceStorage,storageConfig} from '../../server/storage/s3';
// Three seconds avoids the near-zero effective TTL of a second-rounded signature.
// Expiration assertions still wait past the actual expiry; production TTLs unchanged.
export function evidenceTestStorage(){return new S3EvidenceStorage({...storageConfig(),bucket:'communicate-evidence-test',uploadTTL:3,downloadTTL:3});}
export async function clearEvidenceFixtures(db:PrismaClient){const url=new URL(process.env.TEST_DATABASE_URL!);if(url.pathname!=='/communicate_pos_test'||!['127.0.0.1','localhost'].includes(url.hostname))throw new Error('DEDICATED TEST DB ONLY');const storage=evidenceTestStorage();try{const assets=await db.evidenceAsset.findMany();await db.registrationEvidence.deleteMany();for(const asset of assets){await storage.delete(asset.storageKey);if(asset.stagingKey)await storage.delete(asset.stagingKey);}await db.evidenceAsset.deleteMany();}finally{storage.client.destroy();}}
