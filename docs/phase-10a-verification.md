# Phase 10A — Verificación

Baseline real master/ddf3e32. output/tmp ajenos conservados sin seguimiento. Referencia Phase9:589 pruebas únicas; no eliminar existentes ni contar reintentos. Resultados locales .test-results/phase10a ignorados, sin fotos reales.

## Reproducción local

- npm run db:validate / npm run db:generate
- npm run lint / npm run typecheck / npm run build / npm run build:api
- npm test -- --reporter=json --outputFile=.test-results/phase10a/final-unit.json
- npm run test:integration -- --reporter=json --outputFile=.test-results/phase10a/final-integration.json
- npm run test:e2e -- --reporter=json (guardar final-e2e.json; serial tras integración)
- npm run test:cloud-ui (HTTPS dos hosts fixture, sin cloud)
- npm audit --json
- npm run preflight:production -- --local (Phase9 conservado)
- npm run preflight:cloud (local sin conexión externa)
- npm run preflight:cloud -- --configured (configuración+BLOCKED externo, exit1 esperado)

Windows requiere PDF_TEST_PYTHON apuntando a Python real, no stub Windows Store. Pruebas nuevas: URL/públicas/pool/B2/domains/costo/proxy/restore target, worker lock/expiry/retry/idempotencia/maintenance/SIGTERM/orphans, HTTP drain/restart y transferencia cifrada S3 aislada/retención/corrupción. Restore Phase9 verifica DB+objetos/links/permisos/checksums/Decimal/secuencias/sesiones.

ARM64 Docker emulado sólo LOCALLY VERIFIED si smoke completo PASS. Caddy y unidades deben validarse antes de instalar; config preparada no significa TLS activo. Oracle ARM físico/Neon/R2/B2/Pages reales NOT VERIFIED.

## Resultados ejecutados

Cierre local: 12/10/2026. **235 unit + 335 integración + 44 E2E = 614 pruebas únicas PASS**, sin skipped ni flaky. 25 casos nuevos (19 unit/6 integración), no se cuentan reintentos ni comprobaciones adicionales como tests únicos. Lint/TypeScript/build frontend+API/Prisma generate+validate/migration status PASS; 11 migraciones intactas. npm audit cero vulnerabilidades reportadas. Dos avisos PURE upstream de Zod permanecen.

HTTPS local entre app.example.test y api.example.test: Secure/HttpOnly/Host-only/Lax, credenciales CORS, sesión, SPA, CSV, acceso privado y logout PASS. Certificado sintético y CA ignorada sólo fixture; no evidencia TLS público. Caddy validate y systemd-analyze verify ejecutados en Linux aislado: PASS. El bind mount Windows hizo aparecer warnings de permisos de archivos fuente; instalación usa root0644, no instalar world-writable. Reinicio/drain HTTP simulado PASS; scheduler systemd productivo NOT VERIFIED.

Docker linux/arm64 emulado, Node24.19.0: build y smoke argon2/sharp/PDF+Lato/AES/motor Prisma PASS. Prueba de conexión fallida sintética usa puerto9 y no contacta Neon. Windows local Node24.21.0. Compatibilidad física Oracle y proveedores reales NOT VERIFIED. Lockfile completado para dependencias opcionales WASM que npmci ARM exigió; bibliotecas comerciales no actualizadas. Python cryptography genera TLS sintético porque OpenSSL instalado fue bloqueado por control de aplicaciones Windows; no se cambió esa política.

Worker compilado ejecutado manualmente en fixture separada: SUCCESS, sin pendientes ni orphans. Tests cubren lock/reintentos/idempotencia/pausa/interrupción y objetos desconocidos sólo reportados; backup/restore/corrupción/retención/aprobación/checksums PASS en DB y MinIO aislados. Estimador local de2GB×4 copias+margen advierte CRITICAL96,05% del presupuesto10GB; no datos cloud medidos.

Se conservaron dos ejecuciones intermedias fallidas: una durante build ARM observó timeouts/FK de cleanup (no se demuestra causa única); otra atravesó suspensión nocturna con un caso de más10h y carreras posteriores. La suite completa repetida sin carga ARM y con prevención temporal de suspensión pasó335/335 en118,69s. No se relajaron tests/timeouts ni se omitieron casos. No confundir duración suspendida con rendimiento API.

Base operativa actual consultada al cierre:603 clientes/641 equipos/643 IMEIs/118 registros/576 ventas/2 usuarios/0 evidencias. Estos conteos difieren del reporte histórico Phase9; no se usan como snapshot inicial de10A. Fechas máximas de creación: clientes09/10/2026 y ventas14/03/2026, anteriores a esta ejecución. No se borraron/resembraron esos datos para igualar el reporte previo; fixtures usan bases/buckets separados y no se ejecutó migración/exportación operativa. PostgreSQL/MinIO y frontend/API locales comprobados al cierre. Sin push/deploy/aprovisionamiento/exportación real. Proveedores reales NOT VERIFIED; Production ready NO. Preflight cloud local:45 PASS/0 FAIL/8 NOT VERIFIED; exit0. Phase9 local22/22 PASS conservado; configured cloud exit1 esperado por configuración privada faltante y gate externo BLOCKED. Perfil configured no abre conexiones externas.


## Inventario

41 archivos creados:

- `.dockerignore`
- `docs/phase-10a-architecture.md`
- `docs/phase-10a-backblaze-backups.md`
- `docs/phase-10a-cloudflare-pages.md`
- `docs/phase-10a-free-tier-limits.md`
- `docs/phase-10a-manual-checklist.md`
- `docs/phase-10a-neon-postgresql.md`
- `docs/phase-10a-oracle-deployment.md`
- `docs/phase-10a-r2-storage.md`
- `docs/phase-10a-scheduled-worker.md`
- `docs/phase-10a-security.md`
- `docs/phase-10a-verification.md`
- `ops/backblaze/backup.env.example`
- `ops/cloudflare/frontend.env.example`
- `ops/oracle/Caddyfile`
- `ops/oracle/Dockerfile`
- `ops/oracle/api.env.example`
- `ops/oracle/communicate-api.service`
- `ops/oracle/install-template.sh`
- `ops/worker/communicate-worker.service`
- `ops/worker/communicate-worker.timer`
- `ops/worker/worker.env.example`
- `public/404.html`
- `public/_headers`
- `public/_redirects`
- `scripts/arm-smoke.ts`
- `scripts/build-backend.mjs`
- `scripts/cloud-backup.ts`
- `scripts/lib/cloud-backups.ts`
- `scripts/local-test-tls.py`
- `scripts/preflight-cloud.ts`
- `scripts/verify-cloud-provider.ts`
- `scripts/verify-cloud-ui.ts`
- `scripts/worker.ts`
- `server/ops/cloud-configuration.ts`
- `server/ops/runtime.ts`
- `server/ops/worker.ts`
- `server/production.ts`
- `shared/cloud.ts`
- `tests/integration/cloud.test.ts`
- `tests/unit/cloud.test.ts`

13 archivos modificados:

- `.env.example`
- `.gitignore`
- `README.md`
- `eslint.config.js`
- `package-lock.json`
- `package.json`
- `server/auth/middleware.ts`
- `server/evidence/lifecycle.ts`
- `server/lib/errors.ts`
- `server/ops/recovery.ts`
- `src/features/reports/Analytics.tsx`
- `src/services/api.ts`
- `vite.config.ts`
