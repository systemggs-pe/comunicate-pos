# Verificación funcional y entrega

Punto de partida: master / 6786764. Push: NO. Deploy: NO.

## Aislamiento e integridad
Pruebas de integración/E2E sobre communicate_pos_test y bucket communicate-evidence-test. Los proveedores externos se simulan y sus claves se vacían en las configuraciones de prueba. No se consultó CODART/Gemini real ni se generaron ventas de prueba en la base comercial.

Antes de implementar se tomó una huella de filas/tablas de la base comercial. Se mantienen 603 clientes, 641 equipos, 643 IMEIs, 576 ventas, 118 RECOs, usuarios, roles, permisos y configuración. Tras la migración aditiva se comparan las columnas originales (y se verifica que los dos campos nuevos históricos permanecen NULL); no se rellenan ni reinterpretan datos existentes. Herramientas/huellas privadas en .local, fuera de Git.

## Migración
20261017163000_sale_contact_snapshot: dos columnas NULL opcionales en Sale. Sin actualizaciones masivas, cambios de claves, identidades, precios, fechas o estados. No se tocaron migraciones históricas. Aplicada a las bases locales comercial y de pruebas para mantener npm run dev operativo.

## Cobertura
Nueva cobertura de agregaciones de clientes, ventas eliminadas, comprador/propietario distinto, búsqueda real, permisos, contacto por venta, doble envío y respuesta perdida/idempotencia. La matriz visual cubre seis anchos. Se mantienen pruebas de cuatro pasos de registros, cámara primero, escáner automático, CODART, reutilización documental, A4, RBAC, ticket 48/80 mm, pagos, accesorios, dinero exacto y eliminación auditada.

## Ejecución
| Verificación | Resultado |
|---|---|
| Unit | 299 PASS, 19 archivos |
| Integration | 378 PASS, 21 archivos, ejecución completa final |
| E2E general | 44 casos únicos PASS: 42 en ejecución completa y los dos restantes confirmados en repetición de 14/14; se conserva el diagnóstico original |
| E2E MVP | 32/32 PASS en ejecución completa |
| Casos únicos | 753 = 299 + 378 + 44 + 32; reintentos y bucles de viewport no se suman otra vez |
| TypeScript | PASS, también dentro del build final |
| ESLint | PASS, cero advertencias |
| Frontend | PASS; Vite 7.3.7, 5.98 s; entrada JS 346.38 kB / gzip 105.93 kB |
| Backend | PASS |
| Prisma | validate + generate PASS, cliente 6.19.3; 17 migraciones aplicadas y esquema al día |
| npm audit | 0 vulnerabilidades, árbol completo de 586 dependencias |
| Visual | 54 capturas, 6 anchos, inspección manual y comprobaciones de límites |
| Integridad comercial | Huellas de columnas originales coinciden; contactos nuevos de ventas históricas siguen NULL |
| Servicios locales | API 3001, web 5173 y MinIO 59000 responden 200 después de compilar |

Evidencia local ignorada por Git: `sales-unit.log`, `sales-integration.log`, `sales-general-e2e.log`, `sales-general-rerun.log`, `sales-mvp-e2e.log`, `sales-build.log` y `sales-npm-audit.json`, bajo `.test-results/`.

Los dos casos de borrado se sincronizaron con la navegación posterior a la confirmación: el listado de fondo ya estaba visible detrás del nuevo modal y no debía usarse como señal de que el borrado había terminado. Se conservaron las aserciones de filas, archivos privados y referencias compartidas. La ejecución inicial también detectó selectores anteriores a los dos pasos y el error nativo que debía limpiarse al autocompletar; ambos quedaron cubiertos en la regresión final.

El build conserva dos avisos no bloqueantes de anotaciones de Rollup en Zod. No se modificaron dependencias ni se ocultaron errores.

## Límites de verificación
CODART/Gemini real: NO VERIFICADO en esta tarea; se validan contratos y fallos con proveedores simulados. Cámara física, impresora térmica y trámites externos: NO VERIFICADOS. Solicitudes públicas, incidencias y tema oscuro no cuentan con contrato/implementación aprobados; se identifican en UI. Backups cifrados existentes conservados; no se añadió exportación web. Declaración jurada y layout A4 originales permanecen intactos.

## Manifiesto de entrega

15 archivos creados y 35 modificados; una migración aditiva.

### Creados

- `prisma/migrations/20261017163000_sale_contact_snapshot/migration.sql`
- `server/services/client-directory.service.ts`
- `src/components/ReferenceDialog.tsx`
- `src/features/clients/Directory.tsx`
- `src/features/receipts/SavedSaleTicket.tsx`
- `src/features/sales/SaleClientFields.tsx`
- `src/features/sales/sales-reference.css`
- `tests/e2e/mvp-sales-reference.spec.ts`
- `tests/helpers/sale-form.ts`
- `tests/integration/client-directory.test.ts`
- `docs/design-reference-clients-analysis.md`
- `docs/design-reference-functional-verification.md`
- `docs/design-reference-more-menu.md`
- `docs/design-reference-sales-analysis.md`
- `docs/design-reference-visual-comparison.md`

### Modificados

- `prisma/schema.prisma`
- `server/app.ts`
- `server/services/sales.service.ts`
- `shared/receipt.ts`
- `shared/sales.ts`
- `src/app/BottomNavigation.tsx`
- `src/components/FormValidation.tsx`
- `src/components/PermanentDelete.tsx`
- `src/design.css`
- `src/features/clients/ClientPicker.tsx`
- `src/features/equipment/EquipmentForm.tsx`
- `src/features/receipts/Receipt.tsx`
- `src/features/sales/AccessoriesEditor.tsx`
- `src/features/sales/NewSale.tsx`
- `src/features/sales/SaleEquipmentEditor.tsx`
- `src/hooks/useFormStepFocus.ts`
- `src/pages/Clients.tsx`
- `src/pages/RegistrationRequests.tsx`
- `src/pages/Sales.tsx`
- `src/types/pos.ts`
- `tests/e2e/auth.spec.ts`
- `tests/e2e/declaration.spec.ts`
- `tests/e2e/dni.spec.ts`
- `tests/e2e/evidence.spec.ts`
- `tests/e2e/mvp-form-speed.spec.ts`
- `tests/e2e/mvp-registration-redesign.spec.ts`
- `tests/e2e/mvp-scanner.spec.ts`
- `tests/e2e/mvp-vault.spec.ts`
- `tests/e2e/receipts.spec.ts`
- `tests/e2e/refinement.spec.ts`
- `tests/e2e/registration.spec.ts`
- `tests/e2e/sales.spec.ts`
- `tests/e2e/workflow.spec.ts`
- `tests/helpers/navigation.ts`
- `tests/unit/receipts.test.ts`

Los archivos declarativos A4 protegidos no presentan diferencias. `.impeccable/`, `output/` y `tmp/` ajenos siguen sin seguimiento y se conservan íntegros.

## Commits locales

- Implementación: `9c58776`.
- Pruebas: `a323925`.
- Documentación: commit de entrega (HEAD).
- Push y despliegue: NO.
