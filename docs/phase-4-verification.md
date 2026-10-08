# PHASE 4 — AUTH + USERS + ROLES + PERMISSIONS + AUDIT

STATUS: PASS — implementación y verificación local. Producción no verificada.

Fecha: 2026-10-08. Evidencia ejecutada en Windows, Node 24, PostgreSQL 16 Docker
y navegador Edge con Playwright. No se utilizaron credenciales ni datos productivos.

## Baseline y arquitectura

Branch: master. Starting commit: 938b8a9 (Phase 3); Phase 2: 1e58117; Phase 1: 26ffea4.
Estado inicial limpio. No se reconstruyeron los módulos comerciales.

COMUNIC@TE POS is a private single-company application.
It is not a SaaS or multi-tenant platform.

Single company: PASS. SaaS: NO. Multi-tenant: NO. Temporary auth: REMOVED.
Las referencias al acceso temporal sólo quedan como documentación histórica de
fases anteriores y en la revisión inicial. No hay código funcional Bearer compartido,
/api/access, ni API_ACCESS_TOKEN en src/server/scripts/tests/.env.example.

## Database y migrations

| Elemento | Resultado |
|---|---|
| User | PASS: código, email normalizado único, Argon2id, estado, rol, último login; legado conserva ID |
| Role | PASS: SUPERADMIN, ADMIN, SELLER persistidos |
| Permission | PASS: 21 claves; unión RolePermission |
| Session | PASS: persistencia PostgreSQL, sólo tokenHash, expiración e IP/UA limitados |
| AuditLog | PASS: actor real, acción, entidad, metadata segura, IP/UA |
| AuthRateLimit | PASS: contadores persistidos y atómicos por IP/email |
| CompanySettings | No creado: no existe necesidad en este alcance |
| Created migration | 20261008000200_auth_permissions |
| Applied | PASS: main local, test local e instalación limpia temporal |
| Prisma validate / generate | PASS / PASS |
| Migrations anteriores | Sin modificaciones |

Instalación limpia: se creó una DB local temporal nueva, se aplicaron las tres
migraciones, se ejecutó bootstrap y se verificaron 3 roles, 21 permisos y un
SUPERADMIN activo. Se eliminó exclusivamente esa DB recién creada. La DB main
local tiene 3 roles/21 permisos y cero usuarios/clientes/equipos/IMEIs/ventas; no
se introdujeron fixtures en ella. Un correo histórico que colisione tras normalizar
detiene la migración, evitando consolidar identidades silenciosamente.

## Auth

| Control | Resultado |
|---|---|
| Login / Logout / Auth me | PASS: API real, cookie, sesión, auditoría y campos seguros |
| Session persistence | PASS: recarga del navegador y PostgreSQL |
| Session expiration | PASS: 12 horas absolutas, lastUsedAt no prolonga expiración |
| HttpOnly | PASS: cookie inaccesible a document.cookie |
| Secure production | PASS configuración y test unitario; TLS desplegado NOT VERIFIED |
| SameSite | PASS: Lax; Path=/; producción usa __Host-pos_session sin Domain |
| Password hashing | PASS: Argon2id, sal automática, 19 MiB/2 iteraciones/paralelismo 1 |
| Password policy | PASS: 10–128 caracteres, frontend/backend, sin composición arbitraria |
| CSRF | PASS: mutaciones/login exigen Origin exacto autorizado + SameSite |
| CORS | PASS: lista explícita, credentials=true, sin wildcard |
| Rate limit | PASS: DB atómica; 10/email y 30/IP cada 15 minutos; 429 seguro |
| Cleanup | PASS: elimina sesiones/contadores expirados; sin cron instalado |

Bootstrap CLI ejecutado dos veces por E2E: un único SUPERADMIN, sin modificar su
contraseña. ADMIN_NAME/ADMIN_EMAIL/ADMIN_PASSWORD privados requeridos; no se
imprimen. El bootstrap de la cuenta real main está pendiente de esos valores.

## Users, roles y permissions

List/Create/Update/Disable/Enable/Reset password: PASS, incluyendo formularios UI.
Email unique/normalization: PASS en servicio y restricción DB. Desactivar no borra
usuarios ni referencias; desactivación/reset/cambio real de correo o rol revocan
sesiones. Actualizar sólo nombre con el formulario completo conserva la sesión.

SUPERADMIN: 21 permisos protegidos. ADMIN: 19 permisos iniciales, sin roles.update
ni settings.update; no gestiona/asigna SUPERADMIN. SELLER: 10 permisos comerciales,
sin cancelación ni administración. Matriz completa en phase-4-auth-and-permissions.md.
Role editing: PASS para ADMIN/SELLER por SUPERADMIN, revocando sesiones afectadas;
SUPERADMIN no editable. No constructor de roles, empresas ni suscripciones.

Backend enforcement / Frontend can() / Protected routes / Menu visibility: PASS.
Se prueba llamada directa de SELLER a cancelación, aunque el botón esté oculto.
Last superadmin disable / role change: PASS, también ante dos operaciones concurrentes
con bloqueo transaccional compartido por bootstrap y mutaciones.

## Audit y regresiones

Login/Logout/Failed login/User actions/Client actions/Equipment actions/Registration
actions/Sale actions/Sensitive data excluded: PASS. USER_ROLE_CHANGED y
ROLE_PERMISSIONS_UPDATED también auditados. La API rechaza IDs de operador enviados
por el consumidor. AuditLog y EquipmentHistory se conservan como conceptos distintos.

Clients/Equipment/IMEI registration/Sales/Multi-equipment/Buyer != owner: PASS.
También pasan doble IMEI, registro parcial, reutilización, rollback, pagos y cancelación.
Las suites anteriores usan sesiones reales en integración/E2E; la suite API unitaria
simula explícitamente el estado autenticado sólo para probar validación HTTP.

## UI y evidencia visual

Login desktop/375px/390px/430px/Users/Roles/Audit: PASS.
Se capturaron y revisaron 27 pantallas originales de Phase 4: login, dashboard,
usuarios, alta, roles y auditoría a 1280/375/390/430px; venta SELLER a 375/390/430px.
Capturas locales ignoradas: .test-results/phase-4-visual. Contact sheets y recortes
adicionales fueron usados sólo para inspección. Se comprobó scrollWidth <= viewport,
menú completo, formularios utilizables, tablas/cards legibles y estados cargados.
Las suites comerciales también conservaron su revisión responsive.

## Tests y quality gates

| Gate | Resultado |
|---|---|
| Unit/API | PASS: 43 |
| Integration PostgreSQL real | PASS: 165 (62 Phase 2 + 51 Phase 3 + 52 auth) |
| E2E | PASS: 5 (3 auth/admin + 2 regresiones comerciales) |
| Total | PASS: 213 |
| Regression | PASS: suites previas unitarias/API, 113 integración y 2 E2E |
| Lint | PASS, cero warnings ESLint |
| Build | PASS, Prisma generate + TypeScript + Vite |
| TypeScript | PASS |
| Prisma validate / migration status | PASS, tres migraciones al día |
| PostgreSQL | PASS, Docker healthy |
| npm audit | PASS, cero vulnerabilidades |
| git diff --check | PASS |

Comandos ejecutados: npm run lint, npm run typecheck, npm run build, npm test,
npm run test:integration, npm run test:e2e, npx prisma validate, npx prisma migrate
status, npm audit. Prisma generate se ejecuta dentro de build. No se ejecutaron
integración y E2E simultáneamente, pues comparten exclusivamente la DB test.

Fallos encontrados y corregidos antes de PASS:

- Generación inicial de diff desde migrations sin shadow DB: P1003; se generó
  correctamente mediante comparación de schemas, sin modificar migraciones históricas.
- PostgreSQL advisory lock devolvía void con queryRaw: las pruebas expusieron el
  fallo; executeRaw corrigió el bloqueo y toda integración pasó.
- Selector accesible Rol incluía textos de opciones: se corrigió label/htmlFor.
- Navegación móvil conservaba flex y desbordaba a 375px: grid responsive corregido.
- Formulario completo revocaba sesión aunque email/rol no cambiaban: comparación
  real de valores corregida y caso de integración añadido.
- Confirmación de permisos desaparecía al recargar la matriz: aviso movido al padre.
- Último E2E buscaba el nombre aislado cuando el header contiene nombre y rol:
  selector corregido a banner; el guardado era correcto y los cinco E2E finales pasaron.

Vite informa dos anotaciones PURE de Zod existentes que elimina al empaquetar;
Playwright informa NO_COLOR/FORCE_COLOR. No impiden los gates ni se ocultaron.

## Security y límites conocidos

Password plaintext: NO en DB/logs/API. Token in localStorage: NO (storage vacío
verificado E2E). Session token DB storage: sólo SHA-256 de token aleatorio; token
entregado únicamente por Set-Cookie. Secrets: .env/capturas/test-results ignorados;
el repositorio contiene sólo credenciales sintéticas identificadas como test.
Production connection: NO; sólo PostgreSQL local. Push/deploy/tags: NO.

NOT VERIFIED: HTTPS/dominio/proxy/Vercel reales y empaquetado nativo Argon2 en Linux
serverless. Configurar AUTH_ALLOWED_ORIGINS exacto antes de producción. Validar la
cadena de proxy antes de confiar en forwarded IP; Express no confía a ciegas en ella.
No hay recuperación por email, OAuth, SSO, 2FA ni cambio de contraseña propia.
settings.* están preparados; CompanySettings/UI de configuración no implementados.
Limpieza programada y retención de auditoría pendientes. No se creó administrador
real: definir variables privadas y ejecutar npm run seed:admin en main local.

## Documentation y Git

Actualizados README.md y docs/database-architecture.md; creado
docs/phase-4-auth-and-permissions.md y este informe. Las guías Phase 2/3 incluyen
aviso histórico del acceso retirado; sus reportes de verificación no se reescriben.

Commit local requerido: feat: implement authentication roles and permissions.
Identificar hash con git log -1 --oneline; se realiza sólo después de todos los gates.
Git status final se comprueba tras el commit. Sin push, deploy ni tags.

## Files created / modified

Created:

- `docs/phase-4-auth-and-permissions.md`
- `docs/phase-4-verification.md`
- `prisma/migrations/20261008000200_auth_permissions/migration.sql`
- `scripts/cleanup-sessions.ts`
- `scripts/seed-admin.ts`
- `server/auth/middleware.ts`
- `server/lib/audit.ts`
- `server/lib/password.ts`
- `server/services/auth.service.ts`
- `server/services/users.service.ts`
- `shared/auth.ts`
- `src/app/AuthProvider.tsx`
- `src/features/auth/Login.tsx`
- `src/pages/Audit.tsx`
- `src/pages/Roles.tsx`
- `src/pages/Users.tsx`
- `tests/e2e/auth.spec.ts`
- `tests/helpers/auth.ts`
- `tests/integration/auth.test.ts`
- `tests/unit/auth.test.ts`

Modified:

- `.env.example`
- `README.md`
- `docs/database-architecture.md`
- `docs/phase-2-registration-flow.md`
- `docs/phase-3-sales-flow.md`
- `package-lock.json`
- `package.json`
- `playwright.config.ts`
- `prisma/schema.prisma`
- `server/app.ts`
- `server/lib/errors.ts`
- `server/services/pos.service.ts`
- `server/services/sales.service.ts`
- `src/app/ApiProvider.tsx`
- `src/app/App.tsx`
- `src/features/equipment/ImeiCard.tsx`
- `src/pages/Clients.tsx`
- `src/pages/Equipment.tsx`
- `src/pages/Home.tsx`
- `src/pages/Sales.tsx`
- `src/services/api.ts`
- `src/styles.css`
- `tests/e2e/registration.spec.ts`
- `tests/e2e/sales.spec.ts`
- `tests/integration/pos.test.ts`
- `tests/integration/sales.test.ts`
- `tests/unit/api.test.ts`

Deleted (acceso temporal retirado):

- `src/features/auth/TemporaryAccess.tsx`
