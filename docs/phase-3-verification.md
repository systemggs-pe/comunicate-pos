# PHASE 3 — SALES CORE

Fecha: 2026-10-08. STATUS: **PASS** para el alcance local de esta fase.

## Baseline

- Branch: master.
- Starting commit: `1e58117` — feat: implement client equipment and imei registration core.
- La migración histórica `20261007000100_foundation` no tiene cambios.
- Sin push, tag, conexión a producción o despliegue.

## Database / migrations

Sale y SaleEquipment: PASS. Comprador/equipo/propietario/IMEI se leen por FKs.
SaleEquipment conserva el precio histórico, sin copiar datos canónicos.
Money strategy: Decimal(12,2) + Prisma.Decimal en servidor; BigInt en céntimos en UI.
Subtotal derivado de total + discount, validado al commit contra la suma de líneas.

Created: `20261008000100_sales_core` (YAPE/PLIN, discount, notes, función de total).
Applied: base local principal y base local dedicada de pruebas.
Prisma validate: PASS. Prisma generate: PASS (incluido en build).
`prisma migrate status`: dos migraciones, schema al día.
Docker PostgreSQL 16 Alpine: healthy, publicado sólo en 127.0.0.1:55432.

## Sales / client / owner / equipment / IMEI

Create, list, detail, search, cancel, multiple equipment: PASS.
Existing buyer, new buyer, buyer history: PASS.
Buyer = owner y buyer != owner: PASS.
STORE/ACTIVE creation, 1/2 IMEIs, sale relation, equipment detail: PASS.
Unique global, NOT_REGISTERED inicial, search after sale, duplicate prevention: PASS.
La búsqueda y registro posterior de Phase 2 reutilizan el equipo STORE sin duplicar.

## Transactions / money / history

Atomic sale, rollback, concurrency: PASS en PostgreSQL real. Dos peticiones con el
mismo IMEI permiten una sola alta. Un propietario inexistente en equipo 2 revierte
comprador/equipo 1/IMEIs/historial/auditoría; una FK inválida del operador revierte
también las altas previas a Sale. Se verifican conteos completos antes/después.

Subtotal, discount, total, precision: PASS; 0.10 + 0.20 - 0.05 = 0.25 exacto.
La escritura directa con descuento inconsistente o negativo falla en PostgreSQL.

Equipment created, owner assigned, sold, timeline: PASS. SOLD contiene saleId/code
y un enlace a venta. Cancelar conserva eventos y agrega SALE_CANCELLED por equipo
y auditoría con motivo; repetición bloqueada sin eventos duplicados.

## UI / dashboard / API

Desktop 1280, 375px, 390px, 430px: PASS. Ocho pantallas por tamaño, 32 capturas
generadas en `.test-results/phase-3-visual`. Se revisaron las cuatro hojas de contacto
y los originales de formulario desktop/375, lista 390 y detalle 430.
Lista, formulario/resumen, detalle/cancelación, cliente, equipo e inicio: sin overflow
horizontal según scrollWidth, sin loaders pendientes al capturar. Cards apiladas,
precios/totales visibles, inputs y botones utilizables; navegación de cinco opciones.
E2E no detectó errores de página/React. El formulario largo conserva scroll vertical.

Sales today, revenue today, equipment sold today: PASS. Indicadores reales COMPLETED
del día Lima; descuento incluido en ingreso neto, canceladas excluidas, cero real sin ventas.

Endpoints, validation, errors: PASS. Resolve no escribe; POST crea con 201; cancel
exige confirmación/motivo. HTTP valida error SALE_NOT_FOUND, repetición cancelada y
ausencia de DELETE comercial. Formato error.code/error.message preservado.

## Tests y quality gates

| Comprobación | Resultado |
|---|---|
| `npm test` — Unit/API | 33 PASS (24 anteriores + 9 Phase 3) |
| `npm run test:integration` | 113 PASS (62 anteriores + 51 Phase 3) |
| `npm run test:e2e` — Edge | 2 PASS (registro y ventas), ejecución conjunta 53.0s |
| Total | 148 PASS |
| `npm run lint` | PASS, cero warnings |
| `npm run build` | PASS; genera Prisma, comprueba TS y compila Vite |
| `npm run typecheck` | PASS |
| `npx prisma validate` | PASS |
| `npx prisma generate` | PASS mediante build |
| `npx prisma migrate status` | PASS, dos migraciones al día |
| `npm audit` | 0 vulnerabilidades |
| `git diff --check` | PASS |

El E2E verifica Brand existente → Samsung S25 Ultra → dos IMEIs → S/3500 Yape →
confirmación/detalle/equipo/cliente → consulta desde Registros del mismo dispositivo.
Luego crea Rosa con dos equipos, uno de Gianfranco, S/4500 netos Plin, revisa las
pantallas responsive y cancela la primera venta conservando relaciones.
La integración cubre los 36 casos solicitados y validaciones adicionales de FKs,
descuento, compatibilidad, métodos, búsquedas, preflight y cancelación.

Fallos encontrados y corregidos: la primera ejecución E2E de ventas agotó el timeout
porque una etiqueta IMEI contenía input y select. Se separaron sus etiquetas para
dar nombre accesible inequívoco. Se corrigió la selección del DNI del asistente,
que incluye texto de ayuda. Se añadió timeout de acción de 15s. El flujo individual
pasó y posteriormente los dos flujos juntos pasaron. No queda ese fallo pendiente.

Avisos no bloqueantes: Vite elimina dos anotaciones PURE de Zod mal posicionadas;
Playwright avisa del entorno NO_COLOR/FORCE_COLOR. Ambos terminan con exit 0.

## Security / limitations

Temporary auth: preservada sólo en memoria; no se reemplazó ni se agregó persistencia.
Secrets: `.env` y `.test-results` ignorados; sólo `.env.example` está versionado.
Production connection: no usada. La base principal local conserva cero clientes,
equipos, IMEIs y ventas al finalizar las pruebas. Los fixtures y borrados de tests
se restringen a communicate_pos_test, hostname local.

Pendiente: autenticación/roles definitivos e identidad verificada de operador.
La cancelación es administrativa: conserva dueño y registro, libera exclusividad
comercial, no demuestra retorno físico a stock ni ejecuta devolución de dinero.
Descuento sólo por venta; sin pagos parciales, cuotas, inventario avanzado,
integraciones, comprobantes/PDF, devoluciones complejas o migración del POS anterior.
No se verificó ni habilitó funcionamiento en producción.

## Files created

- prisma/migrations/20261008000100_sales_core/migration.sql
- server/services/sales.service.ts
- shared/sales.ts
- src/features/clients/ClientPicker.tsx
- src/features/sales/common.tsx
- src/features/sales/SaleEquipmentEditor.tsx
- src/features/sales/NewSale.tsx
- src/features/sales/RelatedSales.tsx
- src/pages/Sales.tsx
- tests/unit/sales.test.ts
- tests/integration/sales.test.ts
- tests/e2e/sales.spec.ts
- docs/phase-3-sales-flow.md
- docs/phase-3-verification.md

## Files modified

- README.md, docs/database-architecture.md
- prisma/schema.prisma
- server/app.ts, server/repositories/pos.repository.ts, server/services/pos.service.ts
- shared/validation.ts
- src/app/App.tsx, src/components/common.tsx
- src/features/equipment/EquipmentHistory.tsx
- src/pages/Clients.tsx, src/pages/Equipment.tsx, src/pages/Home.tsx
- src/styles.css, src/types/pos.ts
- playwright.config.ts, tests/e2e/registration.spec.ts

## Documentation / git

README y database-architecture actualizados; phase-3-sales-flow describe relaciones,
buyer/owner, STORE/EXTERNAL, precio histórico, múltiples equipos, dinero,
transacción y política de cancelación. Este documento registra la evidencia ejecutada.

Commit local previsto tras todos los gates: `feat: implement sales core`.
El hash y estado final de Git se informan en la respuesta de cierre; no se incluye
un hash autorreferente dentro de este archivo. No se realiza push/deploy.
