# Phase 9 — Preflight de producción

## Comando y decisión

`npm run preflight:production -- --local` verifica sin mutar DB/storage: archivos de migración y sus hashes, schema Prisma, build/manifest, documentos, entry Express, duración, separación de build/migrate, exclusión de `.env` privado y ausencia de secretos configurados en chunks JS. Prueba exclusivamente liveness loopback:3001. Escribe un JSON sanitizado a `.test-results/phase9/preflight-local.json`. Código 0 significa que estos controles locales pasaron; **no significa producción lista**.

`npm run preflight:production` valida además configuración requerida, imprime por nombre PASS/FAIL/NOT VERIFIED y sale no-cero porque las verificaciones externas todavía no están certificadas. No imprime URLs, contraseñas, tokens ni mensajes del CLI Prisma. No migra, crea bucket, despliega, hace seed, cambia políticas ni conecta hosts externos. `.env` local debe fallar en el perfil productivo. Ni siquiera una configuración aparentemente completa convierte pruebas externas en PASS.

Un ambiente con todas las variables correctas sigue PARTIAL mientras falte la evidencia manual enumerada. Conservar resultados, responsable, fecha y entorno de cada comprobación; la presencia de una variable no prueba cifrado, DNS, identidad del proveedor o respaldo restaurable.

El perfil local también lee `_prisma_migrations` únicamente si DATABASE_URL es
loopback:55432/communicate_pos, sin escrituras. Verifica once ejecuciones terminadas
y sus checksums contra variantes LF/CRLF de exactamente el mismo SQL. El historial
Git conserva tres archivos con terminadores distintos; se compara contenido
canónico para no confundir transporte Windows con cambio de SQL. Los hashes raw,
LF y CRLF quedan registrados; cualquier cambio de contenido falla el gate. No se
reescriben archivos históricos ni la tabla de migraciones.

## Variables y requisitos

| Variable / grupo | Uso / gate |
|---|---|
| NODE_ENV | `production`, Vercel Node; no Edge |
| AUTH_ALLOWED_ORIGINS | Dominios reales exactos HTTPS, sin slash/path/query/credenciales ni `*`; cookies mismo origen |
| DATABASE_URL | PostgreSQL administrado, TLS `sslmode=require&sslaccept=strict`, pool de aplicación `connection_limit=1&pool_timeout=10` inicial; capacidad total según instancias |
| DIRECT_URL | Conexión directa del operador, TLS estricto para migrate/pg_dump; no usada automáticamente por schema actual |
| STORAGE_PROVIDER / S3_* | `s3`, bucket privado, endpoint HTTPS limpio (o default AWS), región correcta, claves limitadas, URLs upload≤60s/download30s, 10 MiB máximo |
| S3_SERVER_SIDE_ENCRYPTION / S3_KMS_KEY_ID | AWS AES256 o aws:kms, clave KMS opcional coherente; staging y final reciben headers |
| S3_ENCRYPTION_PROVIDER | `r2-managed` para elección R2, sin headers AWS SSE; sólo declaración de configuración, requiere evidencia del proveedor |
| DNI_PROVIDER / DNI_API_URL / DNI_API_TOKEN | API real HTTPS y contrato canónico validado; token privado; fallback manual permanece; nunca mock en producción |
| ADMIN_PASSWORD | Vacío después del bootstrap; credencial real no versionada ni reutilizada del fixture |
| MAINTENANCE_MODE | false para operar; true durante pausa controlada, bloquea API privado y timer local de limpieza |
| HTTP_LOGGING | Activado en producción; sólo patrón de ruta y métricas sin datos sensibles |
| BACKUP_* / RESTORE_CONFIRM_DATABASE | Sólo operador local, explícitos y privados; no necesarias en el frontend/función Vercel |

`.env.example` es únicamente desarrollo. No copiar credenciales públicas de Docker/local hacia servicios externos. Nunca dar prefijo VITE_ a secretos. No se rotaron secretos reales.

## PostgreSQL y migraciones

11 migraciones existentes; Phase 9 no añade ni edita SQL histórico. Aplicarlas primero a staging aislado mediante URL directa, verificar `_prisma_migrations`, restricciones, índices, secuencias y regresión. `npm run build` genera Prisma/valida TypeScript/construye Vite; **no aplica migraciones**. Schema usa DATABASE_URL: el operador debe proporcionar URL directa como DATABASE_URL únicamente al proceso de `npm run db:deploy`, sin alterar el secreto de aplicación ni imprimirlo. No ejecutar migrate dev en producción.

Una instancia Prisma se reutiliza por proceso, no una conexión por request. El pool serverless depende del proveedor y número de instancias; comprobar límite de conexiones, transacciones serializables, advisory locks, pool_timeout, timeout20s, certificado/CA y capacidad durante cold starts. No asignar 5/21 conexiones por cada instancia sin calcular capacidad. [Prisma 6 PostgreSQL](https://docs.prisma.io/docs/orm/v6/overview/databases/postgresql), [conexiones serverless](https://www.prisma.io/docs/orm/v6/prisma-client/setup-and-configuration/databases-connections).

## Vercel: arquitectura y comprobaciones pendientes

`api/index.ts` exporta una aplicación Express sin listen; el listener/timer está sólo en `server/local.ts`. Es el patrón compatible con [Express sobre Vercel](https://vercel.com/docs/frameworks/backend/express). Node requiere soporte de argon2, sharp, Prisma y fuentes Lato; `includeFiles` incluye las fuentes, sin alterar PDF. Rewrites mantienen API y SPA. Duración declarada 30s. La compatibilidad del patrón no prueba un despliegue que no se ejecutó.

[Límite serverless de payload 4,5 MB](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions): fotos se suben directo al bucket, no al cuerpo JSON. Requests API 32 KiB; export CSV ≤4 MiB, además de 5.000 filas; PDFs existentes comprobados localmente. Verificar en staging límites reales, binarios, cold starts, rutas profundas, PDF fuentes, cookies Secure, CSRF/origins, CORS storage, CSP con worker/frame blob, HTTPS y hostname real. CSP permite `https:` en connect/img hasta fijar proveedor; estrechar a endpoints reales y volver a probar fotografías y PDFs. Nunca introducir `unsafe-eval` o desactivar validaciones.

IP sólo confía en cabecera de plataforma bajo ambiente Vercel productivo; no trust proxy global. [Referencia de headers](https://vercel.com/docs/headers/request-headers). No colocar un proxy externo desconocido sin verificar atribución/rate limit.

`GET /api/health` es liveness público; **no prueba DB ni bucket**. `GET /api/readiness` requiere sesión + settings.read y prueba SELECT1, HeadBucket y número de assets DELETING, sin revelar credenciales/rutas privadas. Ese resultado tampoco prueba política pública, SSE, backups ni scheduler.

## Storage y trabajadores

AWS S3: privado, Block Public Access, IAM restringido a bucket y prefijos, HTTPS, CORS exacto con PUT y headers Content-Type/SSE apropiados, cifrado SSE-S3/KMS verificable, cuotas, versiones y copia externa. Clave API sin permiso de cambiar policy; worker de backup con ListBucket/GetObject limitado. Validar presigned GET/PUT y expiración reales, DELETE idempotente y retries con proveedor seleccionado.

R2: adaptador S3 existente, endpoint de cuenta HTTPS, región `auto`, credenciales limitadas al bucket. No asumir soporte de headers aws:kms/AES256: R2 documenta cifrado administrado [en reposo y tránsito](https://developers.cloudflare.com/r2/reference/data-security/), que debe verificarse en cuenta/proveedor; SSE-C requiere otro diseño y no está implementado. No se contrató ni migró a ninguno.

Instalar trabajador autenticado/aislado que ejecute `npm run evidence:cleanup` y `npm run sessions:cleanup`. El CLI de fotos procesa lotes; si queda pendiente sale2 y requiere reintento. No cabe garantizar 100 objetos con peticiones S3 bajo una función30s: usar worker apropiado con presupuesto, observabilidad y locks. Nunca publicar cleanup sin auth ni depender de setInterval dentro del API serverless.

Propuesta de alertas: 5xx/503 sostenidos, p95 >presupuesto medido, 429 de usuarios legítimos, pool agotado, DELETING/FAILED antiguo>15min, backup atrasado/checksum fallido, worker sin ejecución y capacidad de almacenamiento. Ajustar umbrales a tráfico real; logging privado con retención acordada. Instalar y verificar esos monitores en Phase 10, no sólo declarar variables.

## Rollback

Antes de release: respaldo conjunto validado, registro de eliminaciones protegido, snapshot/versión de esquema y objetos, build anterior y secretos/infra guardados fuera de Git. Desactivar nuevas escrituras/worker; revertir aplicación al release compatible anterior y verificar login/permisos/servicios antes de reanudar. Phase 9 no cambia schema; no requiere revertir migraciones. Para futuros cambios incompatibles preferir corrección hacia adelante; no borrar columnas ni ejecutar SQL inverso improvisado.

Si los datos deben recuperarse, restaurar DB + objetos a recursos nuevos, revocar sesiones, reaplicar eliminaciones posteriores, revisar checksum/referencias/autorización y obtener aprobación operativa antes de cambiar conexiones. Restore no equivale a rollback del código y puede perder cambios desde el snapshot. No sobrescribir el destino activo. Plan productivo aún no ensayado con proveedor real.

## Bloqueos previos a Phase 10

Dominio/TLS/cookies reales; PostgreSQL/pool/CA/staging; bucket privado/TLS/cifrado/CORS/IAM; backup externo completo recuperable; limpieza programada y alertas; contrato/token DNI real; comprobación de binarios y assets en Vercel; revisión jurídica/retención; impresión48/80/A4 y cámara física. Readiness **PARTIAL** hasta resolver y evidenciar esos puntos.
