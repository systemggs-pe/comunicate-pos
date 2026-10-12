# Phase 10A — Neon PostgreSQL

PREPARED; conectividad externa NOT VERIFIED. Prisma6.19.3 permanece. Schema y11 migraciones intactos. Elegir PostgreSQL16 si disponible; si servidor es superior instalar pg_dump/restore compatible antes de backup, nunca pg_dump16 contra17/18.

DATABASE_URL pooled: endpoint -pooler.neon.tech, `sslmode=require&sslaccept=strict`, connection_limit2(max3), pool_timeout10, connect_timeout10. Un PrismaClient API por proceso. Worker usa pool separado y otro cliente de lock con1 conexión; presupuestar suma API+worker+operador. No reintentos ciegos de escrituras comerciales: transacciones/idempotencia y503 ante fallo, UI reintenta lecturas. PgBouncer moderno/Prisma6 no requiere copiar pgbouncer=true de recetas antiguas: verificar en branch aislada.

DIRECT_URL sin -pooler, TLS estricto, sólo operador/migraciones/backups. No agregar directUrl al schema ni obligar local a URL remota. Deploy manual Prisma6 sustituye DATABASE_URL por DIRECT_URL EN ENTORNO privado, nunca argv/historial. No migrate dev/db push productivo, ni ejecución remota10A.

10B: proyecto/branch STAGING vacío sintético; revisión SQL/constraints, backup/snapshot previo, maintenance, `prisma migrate deploy` autorizado, migrate status/checksums11 y pruebas FK/IMEI/Decimal/transacciones/RECO. Guardar evidencia sin DSN. No copiar DB/DNI/fotos operativos ni secretos a CI.

Backup native reutiliza Phase9: pg_dump custom con variables PG privadas, TLSverify-full/CA sistema y timeout conexión10. Restore exige communicate_pos_staging_restore_<sufijo> preexistente SIN tablas públicas y R2 bucket communicate-evidence-staging-restore-<sufijo> existente/vacío. Nunca crea/dropea recurso remoto. Revoca sesiones y verifica metadata/checksums. Local sigue Docker PostgreSQL16.

Monitorear1GB y100CU-h/mes por proyecto. Free no garantiza24/7. Neon caído:503 seguro, sin ventas/registros ficticios ni confirmaciones fallidas. CA/pool/cold starts/cuotas requieren prueba externa.

Fuentes: [Prisma Neon](https://www.prisma.io/docs/orm/overview/databases/neon), [Prisma6 PostgreSQL](https://docs.prisma.io/docs/orm/v6/overview/databases/postgresql), [Neon Free actualizado](https://neon.com/blog/neon-free-plan-1-gb-per-project).

Smoke futuro de sólo lectura: `npx tsx scripts/verify-cloud-provider.ts --authorized-isolated`. Exige nombres staging y URLs proveedor, SELECT1 y HeadBucket; no migra ni escribe. Ejecutar únicamente con acceso autorizado10B. No acredita policy privada/CORS/cifrado; seguir pruebas completas.
