# COMUNIC@TE POS — WORKFLOW ALIGNMENT

STATUS: PASS — flujo local con DNI; limitaciones expresas al final.

## BASELINE

- Rama: `master`; commit inicial: `e404c1b` (Phase 5 DNI).
- Git inicial limpio. Se conservaron Phases 1–5, doble IMEI, auth y arranque Windows.
- Cambios únicamente locales. Sin push, publicación ni cambios productivos.

## DATABASE

- Reutilizados: Client, Equipment, Imei, Sale, SaleEquipment, EquipmentHistory, User, roles, sesiones y AuditLog.
- Nuevos: RegistrationOperation, RegistrationRequest, RegistrationRequestHistory y SaleAccessory.
- Equipment incorpora nombre comercial, color, RAM y ROM nullable para históricos.
- Sale incorpora fecha operativa e idempotencia; fechas históricas se conservan.
- Migración nueva: `20261009000100_operational_workflows`. Las históricas están intactas.
- Unicidad canónica de DNI/IMEI, una solicitud vigente por IMEI, IMEI/celular únicos por operación, clave de confirmación única, FKs RESTRICT y CHECK de contactos/cantidades/importes.
- Triggers diferidos comprueban estados solicitud/IMEI y total de venta con accesorios. Transacciones serializables, locks y reintentos acotados protegen confirmación, edición y transiciones.
- Aplicación a `communicate_pos_test`: verificada. Aplicación a la base local de uso: verificada; cuatro migraciones al día en ambas bases.
- Respaldo previo privado: `.local/workflow-before.sql`, excluido de Git. Conteos de la base local antes de migrar: 1 cliente, 1 equipo, 2 IMEIs, 0 ventas.

## REGISTRATION FLOW

- Cliente existente reutilizado; cliente nuevo se crea solo al confirmar. Contacto de atención requerido se conserva separado del contacto actual.
- Documento operativo disponible: DNI; reutiliza Phase 5 y fallback manual.
- Equipo recuperado por IMEI con propietario, datos técnicos, IMEIs y ventas; selección anterior invalidada al cambiar identidad. Respuestas tardías descartadas.
- Selección explícita de IMEI 1, IMEI 2 o ambos. Registro doble crea dos solicitudes del mismo equipo de forma atómica, con celulares distintos de nueve dígitos que empiezan por 9.
- Claro/Movistar/Entel/Bitel; estados de solicitud e IMEI separados del bloqueo declarado. Precio no negativo, incluido cero; fecha operativa en Lima y actor real.
- Cinco categorías de evidencias opcionales: archivo/cámara compatible, preview, reemplazo y eliminación. Son temporales; no se suben ni se afirma respaldo. Sin caja deshabilita su foto.
- Revisión sin altas anticipadas; confirmación idempotente y códigos RECO individuales.
- Seguimiento con búsqueda/filtros, detalle/historial, corrección pendiente, transición individual, anulación confirmada con motivo, lote con éxitos/fallos y enlace privado autenticado.

## SALES FLOW

- Comprador independiente del propietario; contacto opcional. Cliente/equipo canónicos reutilizados.
- Uno o varios equipos con uno o dos IMEIs; advertencia temprana de venta activa y reventa explícita después de cancelación.
- Accesorios con nombre/cantidad/precio unitario e importe exacto; no son Equipment.
- Efectivo, transferencia, tarjeta, Yape, Plin y otros; fecha operativa Lima.
- Total Decimal en API/PostgreSQL y céntimos BigInt en UI, incluyendo cantidades y descuento.
- Revisión completa y confirmación idempotente. Detalle conserva accesorios, IMEIs, comprador/propietario e importes históricos.
- Edición autorizada de notas; importes y relaciones no se modifican genéricamente. Cancelación conserva historial y no representa reembolso.

## DATA INTEGRITY

- Cliente/equipo/IMEI sin duplicación canónica. Una venta y dos solicitudes siguen perteneciendo al mismo equipo.
- Solicitudes y celulares independientes. Completar IMEI 1 conserva el estado del IMEI 2.
- Segunda solicitud inválida revierte toda la operación; equipo fallido revierte toda la venta.
- Confirmaciones concurrentes y repetidas cubiertas; idempotencia verifica actor y hash.
- Cambios del cliente conservan contactos operativos y precios históricos.

## UX

- Verificación automática de ancho y capturas: escritorio 1280, móviles 375/390/430; 12 vistas del nuevo flujo, 48 capturas en `.test-results/workflow`.
- Inspección visual de formularios, revisión y fichas. Sin desbordamiento horizontal en las vistas probadas.
- Errores junto a campos, primer inválido enfocado, loaders, estados vacíos y borradores conservados ante errores.
- Nombres accesibles y bloqueo de doble envío. Salida por navegación interna, Atrás/Adelante o recarga advierte cambios.
- Prueba explícita de precio inválido/foco, corrección de solicitud/notas, reemplazo/eliminación de fotos y Atrás cancelado conservando el borrador.

## SECURITY

- Sesión real, Argon2id, cookie HttpOnly, permisos backend, origen/CSRF y auditoría Phase 4 conservados.
- Nuevos permisos: registration.cancel y sales.update, inicialmente ADMIN/SUPERADMIN.
- Enlace compartido no contiene DNI/celular ni elimina la autenticación.
- Sin credenciales nuevas compartidas. Actor obtenido de sesión; secretos/fotos/contactos completos no se agregan a AuditLog.
- Historial operativo privado conserva solo los datos necesarios para rastrear correcciones.

## QUALITY

| Control | Resultado |
| --- | --- |
| Unitarias | PASS — 120 |
| API e integración PostgreSQL real | PASS — 215 |
| E2E, fases previas y flujos nuevos | PASS — 25 casos |
| TypeScript | PASS |
| ESLint con cero warnings | PASS |
| Build | PASS — Vite |
| Prisma validate/generate | PASS — Prisma 6.19.3 |
| Migraciones PostgreSQL | PASS — cuatro migraciones al día en prueba y local |
| Docker PostgreSQL 16 | PASS — healthy, 127.0.0.1:55432 |
| npm audit | PASS — 0 vulnerabilidades |
| git diff --check | PASS |

Build completó con dos avisos de anotaciones PURE de Zod; Rollup retiró esos comentarios sin impedir la compilación.

Tests usan solo `communicate_pos_test`, con guardas; integración y E2E se ejecutan secuencialmente. La base local de uso no recibe fixtures.

### Cobertura de los 45 escenarios solicitados

Los números corresponden al apartado 18 del requerimiento. U = unitario; I = API/PostgreSQL; E = navegador.

| Escenarios | Evidencia |
| --- | --- |
| 1–4: cliente/equipo existente/nuevo/externo | I workflow/pos/dni, E workflow A/B y registration/dni |
| 5–8: uno/dos IMEIs y celulares independientes | U workflow, I workflow, E workflow A/B |
| 9: celulares iguales | U workflow, I workflow, E workflow A con error/foco |
| 10: registrado/solicitud vigente | I workflow realizado inicial/duplicados, E workflow B |
| 11–14: estados, precio cero, transición individual, historial | I workflow, E workflow A/B |
| 15–16: limpieza y respuestas tardías | E workflow C; hook con abort y clave de identidad |
| 17: propietario incompatible | I workflow/dual-imei |
| 18–19: rollback doble y concurrencia | I workflow: falla segunda solicitud, claves iguales/diferentes |
| 20–21: evidencias opcionales y revisión sin altas | E workflow A/B, DNI/ventas conservados |
| 22–25: cliente, equipo nuevo, dos IMEIs | I sales/workflow, E sales/dni/workflow A |
| 26–27: advertencia/bloqueo de venta duplicada | E workflow D, I sales/dual-imei |
| 28–31: accesorios, cantidades, total, descuento | U workflow, I workflow/SQL directo, E workflow A |
| 32–33: varios equipos y owner distinto | I sales, E sales/dni |
| 34–35: rollback y cancelación conserva historial | I sales/workflow, E sales |
| 36–39: venta encontrada en registros y ficha sin duplicados | I workflow, E workflow A y sales |
| 40: cambios cliente conservan precios históricos | I workflow: editar cliente, consultar precios/total previos |
| 41–44: sesión, 403, actor, secretos | I auth/workflow, E auth |
| 45: relaciones inconsistentes/identidades sensibles | I workflow/dual-imei, schemas strict y bloqueo de PATCH de identidad |

## DELIVERY

Archivos principales creados: servicio de solicitudes, shared/workflow.ts, shared/operational-date.ts, migración, wizard operativo, listado/detalle de solicitudes, evidencias temporales, accesorios, relaciones de solicitudes, validación de campos, hooks de identidad/salida y tests workflow U/I/E.

Modificados: schema.prisma, app/repository/services API, permisos/validaciones/ventas compartidos, router/App, formularios de equipos/clientes/ventas, fichas, estilos, tipos, fixtures previos, README y arquitectura de datos.

Documentación: workflow-gap-analysis.md, operational-workflows.md y este reporte. La documentación funcional detalla rutas, permisos, estados y políticas.

Commits locales previos a UI:
- a8bc24a — análisis de diferencias.
- b672b60 — modelo/migración y restricciones.
- 5f414b0 — servicios atómicos, accesorios, pruebas U/I.
- 82d623b — correcciones autorizadas e idempotencia concurrente de ventas.
- f92f5ff — wizard, seguimiento, ventas, fichas, UX y regresión E2E.
- El presente reporte se entrega en un commit documental separado.

### Limitaciones expresas

- CE/pasaporte/RUC pendientes de migración segura de identidad y contratos diferenciados; no se habilitan con reglas de DNI.
- Proveedor comercial real de DNI: NOT VERIFIED; mock/fallback manual local reutilizados.
- Cámara depende del navegador/dispositivo. No se implementaron PDF/ticket, escáner sin mecanismo previo ni almacenamiento permanente de fotos.
- PASE no se reinterpretó como EXTERNAL; falta definición comercial.
- Fuera de alcance: OSIPTEL/RENTESEG/CODART, facturación, inventario avanzado, WhatsApp, pagos mixtos y reembolsos avanzados.

Git final limpio tras el commit documental. Aplicación iniciada en http://127.0.0.1:5173 con API en 3001 y Docker healthy. Login, sesión, GET solicitudes/ventas y logout dieron HTTP 200.
Los conteos locales después de migrar siguen en 1 cliente, 1 equipo, 2 IMEIs y 0 ventas; 0 solicitudes ficticias creadas en la base de uso. La cuenta existente conserva sus credenciales. No se hizo push ni publicación.

### Inventario de archivos respecto del baseline

| Cambio | Archivo |
| --- | --- |
| Modificado | `README.md` |
| Modificado | `docs/database-architecture.md` |
| Creado | `docs/operational-workflows.md` |
| Creado | `docs/workflow-gap-analysis.md` |
| Creado | `prisma/migrations/20261009000100_operational_workflows/migration.sql` |
| Modificado | `prisma/schema.prisma` |
| Modificado | `server/app.ts` |
| Modificado | `server/repositories/pos.repository.ts` |
| Modificado | `server/services/pos.service.ts` |
| Creado | `server/services/registration-requests.service.ts` |
| Modificado | `server/services/sales.service.ts` |
| Modificado | `shared/auth.ts` |
| Creado | `shared/operational-date.ts` |
| Modificado | `shared/sales.ts` |
| Modificado | `shared/validation.ts` |
| Creado | `shared/workflow.ts` |
| Modificado | `src/app/App.tsx` |
| Modificado | `src/app/router.tsx` |
| Creado | `src/components/FormValidation.tsx` |
| Modificado | `src/features/clients/ClientFields.tsx` |
| Modificado | `src/features/clients/DniClientFields.tsx` |
| Modificado | `src/features/equipment/EquipmentForm.tsx` |
| Modificado | `src/features/equipment/ImeiCard.tsx` |
| Creado | `src/features/registrations/OperationalRegistrationFlow.tsx` |
| Creado | `src/features/registrations/RequestRelations.tsx` |
| Creado | `src/features/registrations/TemporaryEvidence.tsx` |
| Creado | `src/features/sales/AccessoriesEditor.tsx` |
| Modificado | `src/features/sales/NewSale.tsx` |
| Modificado | `src/features/sales/SaleEquipmentEditor.tsx` |
| Creado | `src/hooks/useEquipmentIdentity.ts` |
| Modificado | `src/hooks/useSubmit.ts` |
| Creado | `src/hooks/useUnsavedChanges.ts` |
| Modificado | `src/pages/Clients.tsx` |
| Modificado | `src/pages/Equipment.tsx` |
| Creado | `src/pages/RegistrationRequests.tsx` |
| Modificado | `src/pages/Sales.tsx` |
| Modificado | `src/styles.css` |
| Modificado | `src/types/pos.ts` |
| Modificado | `tests/e2e/auth.spec.ts` |
| Modificado | `tests/e2e/dni.spec.ts` |
| Modificado | `tests/e2e/dual-imei.spec.ts` |
| Modificado | `tests/e2e/registration.spec.ts` |
| Modificado | `tests/e2e/sales.spec.ts` |
| Creado | `tests/e2e/workflow.spec.ts` |
| Creado | `tests/helpers/workflow.ts` |
| Modificado | `tests/integration/auth.test.ts` |
| Modificado | `tests/integration/dni.test.ts` |
| Modificado | `tests/integration/dual-imei.test.ts` |
| Modificado | `tests/integration/pos.test.ts` |
| Modificado | `tests/integration/sales.test.ts` |
| Creado | `tests/integration/workflow.test.ts` |
| Modificado | `tests/unit/auth.test.ts` |
| Creado | `tests/unit/workflow.test.ts` |
| Creado | `docs/workflow-verification.md` |
