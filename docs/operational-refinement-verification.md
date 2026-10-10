# COMUNIC@TE POS — OPERATIONAL REFINEMENT

**STATUS: PASS** — verificado el 2026-10-09. Aplicación local en http://127.0.0.1:5173/login.

## BASELINE

- Rama: master. Commit inicial: ea505c1f00904c7f4474539bbf902d2aa909b7f4.
- Git inicial limpio. La entrega termina con commits locales y Git limpio; no push ni deploy.
- Modelo conservado: CLIENTE ÚNICO → EQUIPO → IMEI → REGISTRO INDEPENDIENTE; CLIENTE ÚNICO → VENTA → EQUIPO NUEVO → IMEI ÚNICO.

## CLIENTES

- Normalización Unicode NFC en mayúsculas al guardar y al leer campos operativos; Ñ y tildes conservadas.
- Formularios compartidos rellenan nombres, apellidos, celular, correo, dirección y departamento por DNI local.
- Datos locales protegidos como solo lectura en la reutilización. Cambiar DNI limpia el formulario y aborta consultas tardías. Crear un registro/venta no sobrescribe un cliente existente.
- Consulta externa como respaldo; no escribe cliente antes de confirmar y no sobrescribe correcciones manuales.
- Correo guardado en minúscula canónica y visible en mayúscula; búsqueda de clientes insensible a mayúsculas.
- Dirección/departamento nuevos son nullable para conservar clientes anteriores sin inventar datos. Contraseñas, tokens, rutas, UUIDs y números de serie técnicos conservan sus valores.

## REGISTROS

- Únicos estados operativos: BLOQUEADO, REGISTRO PENDIENTE y REGISTRADO. IMEI sin solicitud usa NULL como ausencia, no un cuarto estado operativo.
- Modalidad REGISTRO inicia PENDING automáticamente. MARCAR COMO REGISTRADO afecta solo su solicitud/IMEI.
- Modalidad BLOQUEADO inicia BLOCKED; DESBLOQUEAR confirmado pasa directamente a REGISTERED. Es una acción interna del POS.
- BITEL predeterminado en servidor/UI; CLARO, MOVISTAR y ENTEL permanecen disponibles. Ediciones parciales conservan el operador anterior.
- Referencia vacía toma el celular propio de cada solicitud; referencia manual tiene prioridad y se conserva en correcciones parciales.
- Registro doble tiene solicitudes, celulares, estados y precios independientes. Condiciones retiradas de UI/contratos; columnas legacy conservan lo anterior.
- RECO- de seis dígitos usa secuencia PostgreSQL única, con límite 999999 y sin reutilización tras DELETE.
- createdBy, updatedBy y completedBy diferenciados, obtenidos de sesiones reales, con fecha y cambios auditados.
- Resolución histórica autorizada por el usuario: la solicitud REALIZADA/BLOQUEADO queda BLOCKED con UNBLOCK pendiente. Fechas/estados anteriores y su historial permanecen en campos legacy/eventos.

## VENTAS

- Cada línea crea un equipo nuevo con uno o dos IMEIs únicos. Se retiró el selector de equipos preexistentes, inventario y reventa.
- La búsqueda anticipada advierte IMEI conocido; el servidor revalida dentro de la transacción y PostgreSQL aplica UNIQUE global. Dos operadores no crean ventas duplicadas del mismo IMEI.
- Sale.status, enum SQL comercial, SaleEquipment.isActive, cancelación y permisos cancel retirados. /cancel y /refund devuelven 404.
- Conservados múltiples equipos, comprador/propietario distinto, accesorios, descuentos, métodos de pago, fecha Lima y cálculo Decimal/BigInt.
- Listado con código, fecha, cliente, cantidad, total, pago y usuario; edición autorizada de notas, detalle y eliminación explícita.

## ELIMINACIÓN

- DELETE y preflight para venta, solicitud y expediente de equipo; permisos sales.delete, registration.delete y equipment.delete, inicialmente solo SUPERADMIN.
- Resumen de entidades/conteos, advertencia irreversible, motivo y escritura ELIMINAR. La huella SHA256 se revalida en transacción serializable; si cambian dependencias, 409 y nuevo resumen.
- Venta elimina líneas, accesorios, equipos/IMEIs exclusivos, solicitudes, eventos, operaciones huérfanas y auditoría anterior del conjunto. Nunca elimina clientes.
- Solicitud individual conserva venta/equipo y los demás IMEIs/solicitudes; recalcula solo el IMEI afectado. Historia técnica anterior a la solicitud se conserva.
- Equipo externo huérfano solo se incluye con opción explícita; un expediente con venta obliga confirmar la eliminación integral de esa venta. Dependencias fuera del conjunto bloquean la operación.
- Fallo inyectado de PostgreSQL demuestra rollback de venta, líneas, accesorios, equipo, IMEIs y auditoría.
- Auditoría PERMANENT_DELETION conserva usuario, timestamp, UUIDs y conteos; sin snapshots, IMEIs, DNI, correo, motivo libre, IP o user-agent. entityId no tiene FK hacia entidades borradas.
- Ninguna eliminación real de expedientes se ejecutó en la base local de uso ni en producción. Pruebas de DELETE, fallos y numeración únicamente en communicate_pos_test.

## DATABASE

- Migraciones nuevas: 20261009000200_operational_refinement y 20261009000300_request_completion_integrity. Las cuatro migraciones históricas no se modificaron.
- UNIQUE global de IMEI, equipo exclusivo de una venta y solicitud única por IMEI; slots 1/2, teléfonos independientes, totales Decimal y FKs RESTRICT conservados.
- Triggers diferidos sincronizan solicitud/IMEI; CHECK de finalización exige fecha/actor solamente para REGISTERED.
- Prisma validate y generate: PASS. Checksums de migraciones aplicadas coinciden con los archivos.
- Respaldo privado .local/operational-refinement.dump, restaurado y verificado en communicate_pos_refinement_copy antes de aplicar a main.
- SHA256 del respaldo: `C511F6308AEE481FE13A1026ABAB9845D0F3032BD6A34FF0616F520665F53C73`.
- Ajustes por eventos diferidos de PostgreSQL se resolvieron en la preparación de las migraciones nuevas sobre la copia. Los intentos fallidos se revirtieron y se verificó la aplicación final; no se modificó una migración histórica ni se borraron datos para pasar pruebas.

| Base | Clientes | Equipos | IMEIs | Ventas | Solicitudes | Referencias huérfanas |
|---|---:|---:|---:|---:|---:|---:|
| communicate_pos antes | 1 | 2 | 4 | 0 | 2 | 0 |
| Copia restaurada y migrada | 1 | 2 | 4 | 0 | 2 | 0 |
| communicate_pos después | 1 | 2 | 4 | 0 | 2 | 0 |

Main y copia: una solicitud REGISTERED y una BLOCKED; tres IMEIs REGISTERED y uno BLOCKED. Se conservó toda la identidad de clientes/equipos/IMEIs/solicitudes del baseline.

## QUALITY

| Control | Resultado |
|---|---|
| Unit tests | 131 PASS, 8 archivos |
| API/integración PostgreSQL | 249 PASS, 7 archivos |
| E2E Edge | 27 PASS, 7 archivos |
| Regresión E2E final de registro/ventas/eliminación | 7 PASS adicionales de repetición, sin sumar al total de casos únicos |
| Total de pruebas únicas | **407 PASS** |
| TypeScript / lint | PASS |
| Build Vite / Prisma validate / generate | PASS |
| Docker PostgreSQL 16 | Healthy, 127.0.0.1:55432 |
| npm audit | 0 vulnerabilidades |
| Arranque local, health/login/me/registros/ventas/logout | HTTP 200 |
| git diff --check | PASS |

En Windows se detuvo solo el lanzador propio para liberar la DLL de Prisma antes del build final y se volvió a iniciar después. Advertencias de anotaciones de Zod/Rollup y NO_COLOR no impidieron compilación o pruebas.

### Cobertura de los 43 requisitos

| Criterio | Comprobación | Estado | Evidencia |
|---|---|---|---|
| 1–4 | Nombres, direcciones, marcas/modelos y Unicode Ñ/tildes | PASS | unit/refinement: R1–R4; integración de clientes y equipos |
| 5 | Correo canónico y búsqueda sin distinguir mayúsculas | PASS | unit/refinement R5; integration/refinement R5; autenticación |
| 6 | Autocompletado local de nombres, celular, correo, dirección y departamento | PASS | integration/refinement R6; e2e/dni B y matriz responsive |
| 7–8 | Registro normal pendiente y finalización de un solo IMEI | PASS | integration/refinement R7/R8; e2e/workflow A |
| 9–11 | DESBLOQUEAR para BLOQUEADO y segundo IMEI independiente | PASS | integration/refinement R9/R10/R11; e2e/refinement |
| 12–16 | BITEL, referencia automática/manual, celulares distintos y sin condiciones | PASS | unit/refinement R12/R16; integration/refinement R12–R16; workflow |
| 17–18 | RECO-000001, seis dígitos, límite controlado y concurrencia | PASS | integration/refinement R17/R18; límite restaurado solo en DB test |
| 19–20 | Usuario creador y finalizador reales distintos | PASS | integration/refinement R19/R20; auditoría autenticada |
| 21–22 | Equipos nuevos y ausencia de selector de inventario | PASS | integration/refinement R21; e2e/refinement R22 |
| 23–25 | IMEI existente bloquea, concurrencia y múltiples equipos nuevos | PASS | integration/refinement R23–R25; integration/sales; e2e/sales |
| 26–28 | Sin Sale.status/enum, cancelación o reembolso | PASS | integration/refinement R26–R28; integration/sales contratos retirados |
| 29 | Accesorios, cantidades y dinero decimal exacto | PASS | integration/refinement R29; workflow; triggers SQL de totales |
| 30–33 | Venta elimina expediente propio y conserva cliente/equipos/registros ajenos | PASS | integration/refinement R30–R33; integration/sales 27 |
| 34–35 | Solicitud individual conserva venta, equipo y otro IMEI/solicitud | PASS | integration/refinement R34/R35; historia técnica previa preservada |
| 36 | Expediente externo y opción explícita de equipo huérfano | PASS | integration/refinement R36 (dos casos) |
| 37 | Bloqueo por venta o solicitudes fuera del conjunto confirmado | PASS | integration/refinement R37 (dos casos) |
| 38 | Rollback real ante fallo de PostgreSQL | PASS | integration/refinement R38; trigger temporal exclusivo de DB test |
| 39 | 403 para SELLER y ADMIN sin permiso de eliminación | PASS | integration/refinement R39; autenticación y E2E de roles |
| 40 | Resumen, huella vigente y escritura exacta ELIMINAR | PASS | unit/refinement R40; integration/refinement R40; e2e/refinement modal |
| 41 | Sin referencias huérfanas | PASS | integración de eliminaciones y SQL LEFT JOIN en main/copia/test |
| 42 | RECO no se reutiliza al borrar solicitudes | PASS | integration/refinement R42; secuencia PostgreSQL NO CYCLE |
| 43 | Purga de snapshots y auditoría mínima sin datos sensibles | PASS | integration/refinement R43: UUIDs/conteos/actor; sin motivo, IP o user-agent |

Regresiones anteriores compatibles conservadas. Solo se actualizaron expectativas de reglas retiradas, ausencia de solicitud y normalización; los estados retirados ahora también tienen pruebas explícitas de rechazo.

## UI

Desktop 1280 px y móvil 375/390/430 px verificados mediante E2E y capturas, incluyendo cliente completo, formularios, equipos, historia de IMEI, selección independiente, MARCAR COMO REGISTRADO/DESBLOQUEAR, ventas y modal irreversible. No se detectó overflow horizontal. Capturas privadas de prueba: .test-results/refinement/, .test-results/workflow/, .test-results/phase-5-dni/ y carpetas de regresión.

## DELIVERY

Commits locales funcionales y de verificación:

- a5d25c6 — análisis y respaldo verificado.
- b00f85b0ee79d720b368d02d4c41be5035cfbc5a — modelo, contratos, servicios, UI y regresiones compatibles.
- 84ea9cd03288f475c9fa66328046633012a7b35f — referencias/operador de ediciones parciales y pruebas de refinamiento.
- Commit documental final: incluye este informe, README, política y arquitectura; identificable con git log -1.

Git final limpio. Los bloques funcionales agrupan los contratos compartidos con sus consumidores para que cada commit conserve consistencia. No push, deploy ni cambios de credenciales.

### Archivos creados de entrega (10)

- [docs/operational-refinement-analysis.md](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/docs/operational-refinement-analysis.md>)
- [docs/operational-refinement-verification.md](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/docs/operational-refinement-verification.md>)
- [prisma/migrations/20261009000200_operational_refinement/migration.sql](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/prisma/migrations/20261009000200_operational_refinement/migration.sql>)
- [prisma/migrations/20261009000300_request_completion_integrity/migration.sql](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/prisma/migrations/20261009000300_request_completion_integrity/migration.sql>)
- [server/services/deletion.service.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/server/services/deletion.service.ts>)
- [shared/normalization.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/shared/normalization.ts>)
- [src/components/PermanentDelete.tsx](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/src/components/PermanentDelete.tsx>)
- [tests/e2e/refinement.spec.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/tests/e2e/refinement.spec.ts>)
- [tests/integration/refinement.test.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/tests/integration/refinement.test.ts>)
- [tests/unit/refinement.test.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/tests/unit/refinement.test.ts>)

### Archivos modificados (52)

- [README.md](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/README.md>)
- [docs/database-architecture.md](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/docs/database-architecture.md>)
- [docs/operational-workflows.md](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/docs/operational-workflows.md>)
- [prisma/schema.prisma](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/prisma/schema.prisma>)
- [server/app.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/server/app.ts>)
- [server/auth/middleware.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/server/auth/middleware.ts>)
- [server/services/pos.service.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/server/services/pos.service.ts>)
- [server/services/registration-requests.service.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/server/services/registration-requests.service.ts>)
- [server/services/sales.service.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/server/services/sales.service.ts>)
- [shared/auth.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/shared/auth.ts>)
- [shared/registration.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/shared/registration.ts>)
- [shared/sales.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/shared/sales.ts>)
- [shared/validation.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/shared/validation.ts>)
- [shared/workflow.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/shared/workflow.ts>)
- [src/components/FormValidation.tsx](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/src/components/FormValidation.tsx>)
- [src/components/common.tsx](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/src/components/common.tsx>)
- [src/features/clients/ClientFields.tsx](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/src/features/clients/ClientFields.tsx>)
- [src/features/clients/ClientForm.tsx](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/src/features/clients/ClientForm.tsx>)
- [src/features/clients/DniClientFields.tsx](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/src/features/clients/DniClientFields.tsx>)
- [src/features/equipment/ImeiCard.tsx](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/src/features/equipment/ImeiCard.tsx>)
- [src/features/registrations/OperationalRegistrationFlow.tsx](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/src/features/registrations/OperationalRegistrationFlow.tsx>)
- [src/features/registrations/RegistrationFlow.tsx](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/src/features/registrations/RegistrationFlow.tsx>)
- [src/features/registrations/RequestRelations.tsx](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/src/features/registrations/RequestRelations.tsx>)
- [src/features/sales/AccessoriesEditor.tsx](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/src/features/sales/AccessoriesEditor.tsx>)
- [src/features/sales/NewSale.tsx](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/src/features/sales/NewSale.tsx>)
- [src/features/sales/RelatedSales.tsx](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/src/features/sales/RelatedSales.tsx>)
- [src/features/sales/SaleEquipmentEditor.tsx](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/src/features/sales/SaleEquipmentEditor.tsx>)
- [src/features/sales/common.tsx](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/src/features/sales/common.tsx>)
- [src/hooks/useDniLookup.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/src/hooks/useDniLookup.ts>)
- [src/pages/Clients.tsx](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/src/pages/Clients.tsx>)
- [src/pages/Equipment.tsx](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/src/pages/Equipment.tsx>)
- [src/pages/RegistrationRequests.tsx](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/src/pages/RegistrationRequests.tsx>)
- [src/pages/Roles.tsx](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/src/pages/Roles.tsx>)
- [src/pages/Sales.tsx](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/src/pages/Sales.tsx>)
- [src/styles.css](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/src/styles.css>)
- [src/types/pos.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/src/types/pos.ts>)
- [tests/e2e/auth.spec.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/tests/e2e/auth.spec.ts>)
- [tests/e2e/dni.spec.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/tests/e2e/dni.spec.ts>)
- [tests/e2e/dual-imei.spec.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/tests/e2e/dual-imei.spec.ts>)
- [tests/e2e/registration.spec.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/tests/e2e/registration.spec.ts>)
- [tests/e2e/sales.spec.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/tests/e2e/sales.spec.ts>)
- [tests/e2e/workflow.spec.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/tests/e2e/workflow.spec.ts>)
- [tests/helpers/workflow.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/tests/helpers/workflow.ts>)
- [tests/integration/auth.test.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/tests/integration/auth.test.ts>)
- [tests/integration/dni.test.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/tests/integration/dni.test.ts>)
- [tests/integration/dual-imei.test.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/tests/integration/dual-imei.test.ts>)
- [tests/integration/pos.test.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/tests/integration/pos.test.ts>)
- [tests/integration/sales.test.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/tests/integration/sales.test.ts>)
- [tests/integration/workflow.test.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/tests/integration/workflow.test.ts>)
- [tests/unit/auth.test.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/tests/unit/auth.test.ts>)
- [tests/unit/sales.test.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/tests/unit/sales.test.ts>)
- [tests/unit/validation.test.ts](<C:/Users/ASUS/Documents/comunic@te/comunicate 2.0/tests/unit/validation.test.ts>)

### Limitaciones y pendientes

- Consulta DNI externa comprobada con proveedor simulado; no se validó un servicio externo real ni se añadieron credenciales de terceros.
- CE/pasaporte/RUC permanecen fuera del modelo vigente de identidad; se utiliza DNI.
- DESBLOQUEAR no ejecuta un trámite ante OSIPTEL u operador. Fotos de atención siguen siendo temporales, sin almacenamiento persistente.
- No existe módulo fiscal o archivo persistente sujeto a retención en el modelo actual. Incorporar esas dependencias requerirá integrarlas en el preflight y bloquear cualquier eliminación incompatible.
- No quedan pendientes funcionales, de migración, integridad o autorización dentro del alcance pedido.
