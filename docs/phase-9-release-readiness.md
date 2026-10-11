# Phase 9 — Release readiness

## Decisión

**Local hardening: PASS. Production release readiness: PARTIAL.** Cierre local: 11 de octubre de 2026 (America/Lima). No desplegar hasta resolver las dependencias externas de la tabla. Phase 9 prepara y valida la aplicación local; no certifica infraestructura ni hardware. Baseline `master` / `1e12910`. Commit de entrega: `chore: complete production readiness hardening`; consultar `git log -1` para el identificador real.

## Cobertura por bloque

| Bloque | Diagnóstico / corrección | Evidencia local | Pendiente |
|---|---|---|---|
| 9A Auditoría | Matriz con severidad, impacto, archivos y riesgo | phase-9-security-audit.md | No es pentest ni evaluación jurídica |
| 9B Seguridad | Cookies preservadas ante DB503, orígenes seguros, rate limit persistente, proxy/logs, CSP, SSE | Unit + integración de hardening, UI bajo CSP | Dominio/headers/proxy/IAM reales |
| 9C DB | Mantiene modelo, constraints, secuencias, transacciones y Decimal | Regresión de negocio + restore; 11 migraciones intactas | Capacidad/pool/CA en hosting |
| 9D Recuperación | PostgreSQL + objetos cifrados en recursos nuevos | Descarga/checksum/autorización tras restore | Transporte, automatización y copia externa |
| 9E Storage | MinIO conservado, firmas SSE/KMS preparadas, acceso privado/contextual | MinIO real local, expiración, lifecycle y referencias compartidas | S3/R2 real, TLS/cifrado, worker |
| 9F Rendimiento | Lazy routes, una instancia S3 por servicio, payload CSV acotado | Bundle y ocho escenarios HTTP antes/después | Red/cold starts/escala real |
| 9G Compatibilidad/UX | Build/CSP y cuatro viewports; documentos conservados | 48 comprobaciones de build + pruebas A4/tickets | Vercel runtime y hardware |
| 9H Regresión | Baseline repetido, nuevas pruebas relevantes | Resultados finales en .test-results/phase9 | No incluye pruebas externas productivas |
| 9I Preflight | Verificador de sólo lectura y planes de rollout/rollback | Dos perfiles, fallos productivos esperados | Evidencia externa, no variables de certificación ficticias |

## Validación y evidencia

Baseline confirmado: 190 unit + 323 integración + 44 E2E únicos. Primer intento E2E tuvo un error de configuración del intérprete Python, resuelto configurando `PDF_TEST_PYTHON`; ambas pruebas A4 pasaron al repetirlas. No contar esas repeticiones como pruebas nuevas.

Resultado final: **216 unit + 329 integración + 44 E2E = 589 pruebas únicas PASS**, sin skipped ni flaky. Un intento intermedio observó navegación inesperada al paso inicial durante cambios de archivos; la prueba específica pasó con trace y la suite completa pasó al repetirla con fuentes sin cambios. No contar reintentos como nuevos casos. Lint, TypeScript, build, Prisma generate/validate y estado de migraciones PASS; npm audit: cero vulnerabilidades reportadas. Preflight local: 22/22 PASS, exit0. Perfil productivo: exit1 esperado, readiness PARTIAL por configuración y verificación externa pendientes. Al continuar tras el reinicio se inició Docker Desktop y se comprobó PostgreSQL/MinIO; no se modificaron migraciones ni datos para satisfacer el gate.

Build CSP local: 48/48 comprobaciones, 1280/375/390/430 px, 12 rutas, sin overflow de página ni errores JS/CSP. Capturas revisadas; tablas anchas conservan desplazamiento horizontal dentro del contenedor. Esto no constituye prueba física de cámara.

Declaración original: una página A4, 165 palabras fijas, dos líneas de firma, fuentes Lato. Comparación con `20261010144319_register_device.pdf`: cobertura tolerante 99,85% del original /99,93% generado, umbral98%, tolerancia2px; se conservan las diferencias tipográficas originales documentadas en Phase6B. No se modifica texto, posiciones ni se incluyen fotografías.

Recuperación: datos sintéticos, DB y objetos, checksums/links/autorización/sesiones/secuencia comprobados. Los recursos restaurados quedan aislados para revisión y no se activan en el POS operativo. La duración de una prueba pequeña no acredita el RTO de una base productiva.

Datos operativos leídos antes/después, sin escrituras: 1 cliente, 2 equipos, 4 IMEIs, 2 registros, 0 ventas, 1 usuario, 0 evidencias. Reporte mensual conserva 300,00 de servicios, 2 registros y 1 cliente nuevo; nueve índices analytics. Datos reales no usados en pruebas destructivas.

## Checklist de lanzamiento

| Requisito | Estado actual | Evidencia/acción necesaria antes de activar |
|---|---|---|
| PostgreSQL administrado | NOT VERIFIED | Operador elige proveedor, TLS/CA, pool/connection budget, staging migrado y backup |
| Proveedor S3 productivo | NOT VERIFIED | Elegir AWS S3/R2 u otro mantenido, bucket privado, IAM, CORS, TLS/cifrado, firmas y cleanup |
| Variables privadas | Pendiente | Secrets manager/entorno, sin valores de ejemplo; quitar bootstrap tras alta; preflight real |
| Dominio/HTTPS/cookies | NOT VERIFIED | DNS/TLS, cookie Host Secure, origen exacto, CSP, ruta SPA/API y proxy comprobados |
| DNI real | NOT VERIFIED | Contrato compatible, token real, timeout/rate limit/fallback y revisión de tratamiento de DNI |
| Backups externos | NOT VERIFIED | Instalación, retención, cifrado, copia externa y monitor de antigüedad |
| Restore productivo | NOT VERIFIED | Recuperar DB + foto/versiones en entorno aislado del proveedor, medir RPO/RTO |
| Worker limpieza/sesiones | Pendiente | Ejecución programada fuera de listener, cola/outbox, alertas y reintentos |
| Impresora48mm | NOT VERIFIED | Papel/márgenes/escala y legibilidad en equipo físico |
| Impresora80mm | NOT VERIFIED | Papel/márgenes/escala y legibilidad en equipo físico |
| Impresión A4 | NOT VERIFIED | Papel A4 real, escala100%, firmas/legibilidad |
| Cámara móvil | NOT VERIFIED | Captura real HTTPS, permisos, orientación, peso y reintento |
| Privacidad Perú | Pendiente | Revisión jurídica, retención, encargados/derechos/incidentes, borrado de copias |
| Deploy frontend/API | Phase 10 | No realizado; verificar Node/binarios/fuentes, red, payload/cold start |
| Smoke productivo | Phase 10 | Login/logout, roles, ventas, dos RECO, PDF, fotos, reportes, cleanup y restore |

Responsables de infraestructura, respaldo, seguridad/legal y hardware deben ser designados por el proyecto. No contratar servicios ni inventar cuentas en este documento. Backups/restore son gates técnicos; hardware y DNI también deben quedar explícitamente aceptados o verificados antes de operar las funciones correspondientes.

## Limitaciones de entrega

- MinIO local sin TLS/SSE verificado; cifrado AES-GCM de backups sí probado. No equivale a cifrado en reposo de objetos del servicio local.
- CLI de recovery intencionalmente restringido a Docker/loopback y recursos nuevos; transporte externo productivo aún por instalar/validar.
- Load moderado, fixture pequeña y sintética; no se probaron saturación, tráfico masivo, red móvil o archivos al límite en serverless.
- Capturas y JSON de ejecución se conservan localmente ignorados por Git; las métricas/resumen y comandos reproducibles sí están documentados.
- Avisos upstream PURE de Zod permanecen; zero npm audit no certifica ausencia de todas las vulnerabilidades.
- Datos operativos, PDF original y `output/`/`tmp/` ajenos conservados. Sin push ni deploy.

## Inventario de entrega

18 archivos creados:

- `docs/phase-9-security-audit.md`, `docs/phase-9-backup-restore.md`, `docs/phase-9-performance.md`, `docs/phase-9-production-preflight.md`, `docs/phase-9-release-readiness.md`.
- `scripts/backup.ts`, `scripts/lib/phase9-fixture.ts`, `scripts/measure-bundle.mjs`, `scripts/phase9-load.ts`, `scripts/production-preflight.ts`, `scripts/verify-production-ui.ts`.
- `server/ops/configuration.ts`, `server/ops/recovery.ts`, `server/ops/security.ts`, `src/app/RouteBoundary.tsx`.
- `tests/unit/phase9.test.ts`, `tests/integration/phase9-hardening.test.ts`, `tests/integration/recovery.test.ts`.

21 archivos modificados:

- `.env.example`, `README.md`, `docker-compose.yml`, `package.json`, `vercel.json`, `vite.config.ts`.
- `docs/database-architecture.md`, `docs/phase-7-evidence-storage.md`.
- `scripts/cleanup-evidence.ts`, `scripts/cleanup-sessions.ts`.
- `server/app.ts`, `server/auth/middleware.ts`, `server/evidence/service.ts`, `server/lib/errors.ts`, `server/local.ts`, `server/services/reports.service.ts`, `server/storage/s3.ts`.
- `shared/reports.ts`, `src/app/App.tsx`, `tests/helpers/evidence.ts`, `tests/integration/evidence.test.ts`.
