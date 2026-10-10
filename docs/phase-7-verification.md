## PHASE 7 — SECURE EVIDENCE STORAGE

STATUS: PASS (implementación y verificación local)

### BASELINE

- Branch: master.
- Starting commit: b548449f22efc1e51e37f6a4d37517296d3ad035.
- Git status: limpio al comenzar. Los archivos ajenos que aparecieron durante el trabajo se conservan fuera de los commits.

### DATABASE

- EvidenceAsset: PASS; metadatos, propietario/sesión, alcance, checksum, dimensiones, estados y expiración.
- RegistrationEvidence: PASS; vínculo explícito RECO/categoría/activo, único por categoría y solicitud.
- Migration: PASS; 20261010000300_private_evidence y 20261010000400_evidence_integrity_guards aplicadas a las dos bases locales; diez migraciones en total.
- Foreign keys: PASS; solicitudes y activos RESTRICT, usuarios/sesiones SET NULL.
- Shared evidence: PASS; cuatro fotos comunes y dos IMEI lógicos independientes: seis activos READY y diez asociaciones.
- Referential integrity: PASS; FKs, checks, triggers, inmutabilidad, alcance y borrado del último vínculo.

### STORAGE

- MinIO: PASS; imagen compilada desde revisión oficial fija, contenedor healthy.
- S3 abstraction: PASS; interfaz independiente y proveedor AWS SDK.
- Private bucket: PASS; GET anónimo rechazado con 403, sin política pública.
- Docker persistence: PASS; archivo recuperado tras recrear el contenedor sobre evidence_data.
- Upload: PASS; PUT firmado directo, tamaño/tipo firmados, checksum y validación servidor, clave definitiva distinta.
- Download: PASS; autorización contextual, GET firmado, attachment WebP y no-store.
- Delete: PASS; última referencia encola eliminación; preserva archivos compartidos.
- Cleanup: PASS; vencidos/fallidos/DELETING, reintentos idempotentes y protección de ventanas PUT/verificación.
- Production compatibility: proveedor S3/R2 preparado; conexión/despliegue productivo NOT VERIFIED.

### REGISTRATION

- DNI FRONT: PASS; opcional, compartido explícitamente o independiente.
- DNI BACK: PASS; opcional, compartido explícitamente o independiente.
- DEVICE BOX: PASS; opcional.
- PURCHASE RECEIPT: PASS; opcional.
- LOGICAL IMEI: PASS; independiente por IMEI, compartirlo rechazado.
- One IMEI: PASS; cinco categorías y segundo IMEI sin registrar.
- Double IMEI: PASS; dos solicitudes atómicas y celulares independientes.
- Shared images: PASS; RECO-000101/102 utilizan los mismos cuatro activos comunes.
- Independent images: PASS; IMEI lógico y categorías comunes pueden tener fotografías distintas.

### SECURITY

- Authentication: PASS; 401 sin sesión; borradores ligados al usuario y sesión.
- Permissions: PASS; cuatro permisos nuevos; SUPERADMIN completo, ADMIN/SELLER sin acceso a fotografías por defecto, concesión explícita configurable.
- Private access: PASS; comprobación de solicitud, vínculo y READY; IDs cambiados rechazados.
- Signed URLs: PASS; GET por defecto 30 s, PUT 60 s, máximo 60 s; caducidad real comprobada con TTL de prueba de 1 s.
- File validation: PASS; JPEG/PNG/WebP reales, firmas, checksum, 10 MB, 32 px mínimo, 20 MP y 12000 px máximo por lado.
- Metadata cleanup: PASS; EXIF/GPS/ICC removidos, orientación corregida, WebP lossless sin reducción de resolución.
- Encryption: HTTP loopback de desarrollo; HTTPS requerido fuera del entorno local. SSE/KMS y cifrado productivo en reposo NOT VERIFIED; no configurados localmente.
- Audit: PASS; EVIDENCE_UPLOADED/REPLACED/DELETED/DOWNLOADED con actor/fecha/RECO/categoría/asset; sin fotos, documentos, tokens o URLs.

### UI

- Desktop: PASS; revisión visual y E2E a 1280 px.
- 375px: PASS; capturas y control de overflow horizontal.
- 390px: PASS; capturas y control de overflow horizontal.
- 430px: PASS; capturas y control de overflow horizontal.
- Camera: input capture=environment y selección sintética PASS; cámara física/permisos nativos/retorno Android/iPhone NOT VERIFIED.
- Gallery: PASS; input independiente, selección, validación y reintento.
- Preview: PASS; proporción conservada, ampliación y cierre de modal, URL fresca.
- Replace: PASS; nueva imagen validada y preview/confirmación; error conserva la anterior; otro RECO no cambia.
- Delete: PASS; confirmación individual y advertencia de limpieza pendiente.

### DATA INTEGRITY

- Rollback/compensation: PASS; transacción SQL del lote y asociaciones; storage separado con estados y compensación, sin afirmar ACID distribuido.
- Temporary cleanup: PASS; TTL de una hora; worker local de 60 s y comando manual. Tombstones cubren PUT y verificación interrumpida.
- Shared reference preservation: PASS; borrar/reemplazar un vínculo conserva los demás.
- Permanent deletion: PASS; registros, equipos y ventas incluyen evidencias en preview/fingerprint; fallo real de endpoint deja cola recuperable.
- Client preservation: PASS; cliente conservado en el criterio principal y en eliminación integral de venta.

### REGRESSION

- Clients: PASS; consultas, edición, relación y conservación.
- Equipment: PASS; equipo único con dos IMEIs y propietario correcto.
- Registrations: PASS; estados, dobles, idempotencia, snapshots y transiciones independientes.
- Sales: PASS; precios, accesorios, métodos y eliminación integral.
- Thermal tickets: PASS; pruebas 48/80 mm, PDF, preview e impresión del navegador; fuentes de Phase 6A sin cambios. Impresora física NOT VERIFIED.
- A4 declarations: PASS; PDF de una página por IMEI, confirmaciones y preview; fuentes/layout/plantilla de Phase 6B sin cambios. Impresión física NOT VERIFIED.
- Users: PASS; administración, sesiones, desactivación y reset.
- Roles: PASS; permisos y cierre de sesiones; etiquetas de evidencias configurables en UI.
- Audit: PASS; trazabilidad existente y conservación de eventos técnicos de fotografías tras borrar operaciones.

### QUALITY

- Unit: PASS; 154 pruebas en once archivos.
- API: PASS; cubiertas en la suite de integración, sin contabilizarlas dos veces.
- Integration PostgreSQL: PASS; 283 casos únicos: pasada completa de 282 y suite final de evidencias de 21, que añade un caso de concurrencia.
- Integration MinIO: PASS; 21 pruebas de evidencias, con almacenamiento real y fallos controlados; incluida en integración PostgreSQL/API.
- E2E: PASS; pasada completa de 36; seis casos de auth/evidencias repetidos tras los ajustes finales, todos PASS.
- Total: PASS; 473 pruebas únicas (154 + 283 + 36); las repeticiones no aumentan el total.
- Lint: PASS; cero advertencias ESLint.
- TypeScript: PASS; comprobación standalone y durante build.
- Build: PASS; Vite/Prisma/TypeScript. Avisos no bloqueantes: anotaciones de terceros Zod y chunk principal de 528 kB.
- Prisma: PASS; validate/generate y dos migraciones nuevas; no se modificaron migraciones anteriores.
- npm audit: PASS; cero vulnerabilidades.

### DELIVERY

- Files created: 21 archivos; inventario completo abajo.
- Files modified: 22 archivos; inventario completo abajo.
- Documentation: README, arquitectura de base de datos, phase-7-evidence-storage.md y este reporte.
- Commits: 3ef86be (infraestructura), 5516dcc (backend/integridad); cierre local «feat: implement secure registration evidence storage», identificable con git log. Sin push ni despliegue.
- Git status: cambios de Phase 7 guardados en commits locales; output/ y tmp/ ajenos a Phase 7 permanecen sin seguimiento, sin agregar ni borrar sus archivos.
- Known limitations: MinIO Community archivado/sin mantenimiento activo; sólo entorno local. Cámara y dispositivos físicos, TLS/SSE/KMS/retención productivos y proveedores externos NOT VERIFIED. Un GET ya autorizado funciona hasta expirar aunque se cierre sesión. Borrar objetos activos no borra backups, versiones, descargas previas o retenciones externas. Cleanup opera en lotes de 100. Avisos de build no bloqueantes. output/ y tmp/ no pertenecen a esta entrega.

## Inventario

Archivos creados:

1. ops/minio/Dockerfile
2. prisma/migrations/20261010000300_private_evidence/migration.sql
3. prisma/migrations/20261010000400_evidence_integrity_guards/migration.sql
4. scripts/cleanup-evidence.ts
5. scripts/provision-evidence.ts
6. server/evidence/image.ts
7. server/evidence/lifecycle.ts
8. server/evidence/service.ts
9. server/storage/provider.ts
10. server/storage/s3.ts
11. shared/evidence.ts
12. src/features/evidence/EvidenceDrafts.tsx
13. src/features/evidence/EvidenceSection.tsx
14. src/features/evidence/evidence.css
15. src/features/evidence/upload.ts
16. tests/e2e/evidence.spec.ts
17. tests/helpers/evidence.ts
18. tests/integration/evidence.test.ts
19. tests/unit/evidence.test.ts
20. docs/phase-7-evidence-storage.md
21. docs/phase-7-verification.md

Archivos modificados:

1. .env.example
2. README.md
3. docker-compose.yml
4. docs/database-architecture.md
5. package-lock.json
6. package.json
7. playwright.config.ts
8. prisma/schema.prisma
9. scripts/local.mjs
10. server/app.ts
11. server/local.ts
12. server/services/deletion.service.ts
13. server/services/pos.service.ts
14. server/services/registration-requests.service.ts
15. shared/auth.ts
16. shared/workflow.ts
17. src/components/PermanentDelete.tsx
18. src/features/registrations/OperationalRegistrationFlow.tsx
19. src/pages/RegistrationRequests.tsx
20. src/pages/Roles.tsx
21. tests/e2e/workflow.spec.ts
22. tests/unit/auth.test.ts

## Cobertura de los 49 requisitos de prueba

| Requisitos | Evidencia |
|---|---|
| 1–9 Archivos, dimensiones, orientación, EXIF | tests/unit/evidence.test.ts; JPEG/PNG/WebP y rechazo de checksum/firma/tamaño también en integración real |
| 10–15 PostgreSQL, asociaciones, FK y cruces | tests/integration/evidence.test.ts: principal, SQL scope, FKs, inmutabilidad |
| 16–21 Doble IMEI y referencias compartidas | principal API y E2E, RECO-000101/102 y seis archivos/diez relaciones |
| 22–29 Autorización, privacidad y URLs | 401/403, permisos conservadores/concesión, bucket privado, DTO, IDs, expiración, claves UUID y firma PUT |
| 30–34 Persistencia/descarga | logout/login E2E, recreación MinIO y reinicio de proceso API real, imagen y attachment recuperables |
| 35–42 Reemplazo/eliminación/compensación | reemplazo API/UI, cola de fallo real, cleanup, venta integral, cliente y solicitud hermana conservados |
| 43–49 Regresión | suites existentes A4/térmicos/IMEI/workflow/auth/sales/audit; diff de archivos Phase 6A/6B vacío |

Fixtures: communicate_pos_test y communicate-evidence-test exclusivamente;
fotografías sintéticas, ninguna imagen real de cliente agregada al repositorio.
Capturas locales ignoradas: .test-results/evidence, .test-results/e2e y suites previas.
Los contadores comerciales de la base de uso se conservan: 1 cliente, 2 equipos,
4 IMEIs, 2 solicitudes, 0 ventas y 1 usuario. Frontend 5173 y API 3001 responden 200;
PostgreSQL y MinIO healthy al cierre. El volumen PostgreSQL original no se borró.
