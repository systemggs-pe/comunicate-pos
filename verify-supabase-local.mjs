import {PrismaClient} from '@prisma/client';
const local=new PrismaClient();
const remote=new PrismaClient({datasources:{db:{url:process.env.DIRECT_URL}}});
const summary=db=>db.$queryRaw`
 SELECT (SELECT count(*) FROM "Client")::int AS clients,
 (SELECT count(*) FROM "Equipment")::int AS equipment,
 (SELECT count(*) FROM "Sale")::int AS sales,
 (SELECT count(*) FROM "RegistrationRequest")::int AS registrations,
 (SELECT count(*) FROM "EvidenceAsset")::int AS evidence,
 (SELECT count(*) FROM "_prisma_migrations")::int AS migrations,
 (SELECT last_value::text || ':' || is_called::text FROM sale_code_seq) AS sale_sequence,
 (SELECT last_value::text || ':' || is_called::text FROM registration_code_seq) AS registration_sequence
`;
try {
 const [source,target]=await Promise.all([summary(local),summary(remote)]);
 console.log(JSON.stringify({source,target,matching:JSON.stringify(source)===JSON.stringify(target)}));
 if(JSON.stringify(source)!==JSON.stringify(target))process.exitCode=1;
} finally {await Promise.all([local.$disconnect(),remote.$disconnect()]);}
