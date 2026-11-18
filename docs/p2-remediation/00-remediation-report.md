# COMUNIC@TE POS 2.0 — PHASE 4 P2 REMEDIATION

**STATUS: PASS LOCAL para los criterios técnicos AUD-06–10. El sistema sigue NOT READY para producción.** AUD-04 permanece PARCIAL y AUD-05 BLOQUEADO EXTERNO. Los históricos comerciales no se sanearon ni se dieron por revisados.

20/10/2026, America/Lima. El texto recibido termina a mitad de la sección 12; se ejecutaron el alcance, ciclo, criterios, pruebas y commits explícitos anteriores sin inventar requisitos ausentes.

## Baseline y alcance

- Rama: master. Inicio real: `1c586d2fff1ba06fbd84a3c52da51ab5218eb012`, posterior a P1; no se retrocedió.
- Código final comprobado: `67875fe`; después sólo se documentan resultados/evidencias, sin cambios funcionales. El hash del commit de entrega se informa al finalizar.
- Git inicial sin cambios rastreados; .impeccable/, output/ y tmp/ ajenos sin seguimiento conservados. No se reescribió Phase3 ni se alteraron datos para igualar conteos.
- Informes originales leídos y los cinco problemas/interdependencias comprendidos antes de cambiar código: [matriz inicial](01-initial-matrix.md).
- Sin despliegue, push, servicios cloud, credenciales productivas modificadas, migraciones comerciales, rediseño visual, actualización de dependencias ni trabajo AUD-11.

## Resultado por hallazgo

| Hallazgo original / criterio | Corrección o comprobación | Evidencia / estado |
|---|---|---|
| AUD-06 — departamento en vez de provincia. Individual/doble/bloqueado conservan provincia y no agrupan ubicaciones incompatibles | Campo operativo opcional, contacto guardado, payload/resumen y plantilla; agrupación compara provincia. Si falta histórica no se inventa | 10 unitarias, regresión API y navegador. **RESUELTO LOCAL**. [Ficha](02-aud-06.md) |
| AUD-07 — Prisma no representa estado de migraciones. Historia vacía y definición reconciliadas, SQL intencional justificado | Defaults UUID/updatedAt, seis ON UPDATE NO ACTION y único operationId/phone en Prisma. Sin SQL correctivo ni cambio en las 19 migraciones | DB nueva migrada, diff vacío/exit 0, validate y 2 contratos SQL PASS. **RESUELTO LOCAL**. [Ficha](03-aud-07.md) |
| AUD-08 — lado de fotos por índice sin contrato probado. Sin etiquetas no confirmar sin contrato o revisión explícita | Adaptador conserva fotos sin lado; se elimina inferencia secundaria automática en PhotoDni/vault; endpoint antiguo rechaza sin escribir. Selector humano existente confirma cada foto | 39 unitarias CODART, 30 integración relacionadas y regresión UI. Proveedor real NOT VERIFIED. **RESUELTO LOCAL por alternativa de revisión explícita**. [Ficha](04-aud-08.md) |
| AUD-09 — preferencias ignoradas por ticket fijo. Cada control visible tiene efecto explicado o deja de ofrecerse | Se retiran controles ignorados y se aclara alcance de nombre comercial A4/cabecera/márgenes/formato; contrato guardado compatible, plantilla igual | 12 unitarias y E2E de configuración/ticket. **RESUELTO LOCAL**. [Ficha](05-aud-09.md) |
| AUD-10 — 70/643 históricos no Luhn en auditoría original. Consulta histórica y nuevas escrituras válidas, sin perder asociaciones | Se verifica implementación existente con cinco regresiones de consulta, rechazo, autorización, concurrencia y corrección trazable; no se inventa otro flujo ni se repara checksum | 5 API PASS con venta/RECO/documentos sintéticos. **RESUELTO LOCAL en criterio técnico; revisión de los históricos reales pendiente de autorización individual**. [Ficha](06-aud-10.md) |

No se confunde la corrección propuesta de revisar casos reales con afirmar que ya se revisaron los 70. No se consultaron ni exportaron IMEI/DNI/fotos comerciales durante esta fase. Esos agregados son históricos de la auditoría original, no un nuevo conteo actual.

## Verificación y regresión

| Grupo | Resultado final | Alcance y límites |
|---|---|---|
| Unitarias | **322/322 casos consolidados PASS** | Primera ejecución 317/322: cinco PDF fallaron por alias Python Windows. Se repitieron completos sólo los dos archivos afectados, 10/10 PASS, con intérprete explícito. Último resultado por archivo completo, manteniendo casos parametrizados con título repetido. No una única ejecución continua 322/322 |
| Integración enfocada + regresión | **302/302 PASS**, sin pendientes | 68 casos enfocados P2 + 234 de nueve suites de ventas, flujo RECO, doble IMEI, recibos, declaración A4, expediente de evidencias, permisos y scanner. No suites de cloud/reinicio/restore ajenas |
| E2E enfocado | **6/6 PASS**, cero omitidos/flaky | Dos regresiones nuevas de provincia/foto y cuatro casos existentes reforzados: configuración responsive, PDF/preview/impresión 58/80 y selector. Fotos UI interceptadas sólo sintéticas; backend privado probado aparte |
| Prisma | **PASS** | validate; diff exit 0; 19 migraciones aplicadas desde base nueva, historial intacto |
| TypeScript / ESLint | **PASS** | Typecheck intermedio y tsc incluido en build oficial limpio; lint cero warnings |
| Instalación/build oficial | **PASS** | npm ci, prisma generate + tsc + Vite y build:api en copia con node_modules independientes; 315 archivos comparados iguales; sin copiar .env ni tocar DLL del POS |
| UI focal | **PASS acotado** | Impeccable + UI UX Pro Max; tres targets, detector sin hallazgos, pruebas de etiquetas/acciones y overflow. No auditoría UI global ni cambios de animación |

Casos nuevos: **16 unitarios, 9 integración y 2 E2E**. No se suman reintentos ni se añaden los resultados actuales al contador histórico 770. Detalle por archivo, resultados fallidos iniciales y consolidación: [verificación](07-verification.md), evidence/verification-summary.json y reportes nativos.

Los primeros errores se preservan: motor genérico al iniciar la base recién creada; fixture bloqueado que intentaba cambiar sólo RECO rechazado por trigger; parametrización incorrecta de cinco tests nuevos; alias Python en los cinco PDF. Se corrigieron los guiones/fixtures/configuración, no las reglas del producto para acomodar tests. No quedan fallos locales sin resolver en el alcance ejecutado.

## Aislamiento y datos

Escrituras únicamente en PostgreSQL/MinIO nuevos: proyecto `communicate-phase4-20261020`, contenedores `communicate-test-phase4-20261020-postgres/minio`, puertos loopback 55438/59040 y volúmenes `...-pgdata`/`...-s3data`. Credenciales sintéticas nuevas, proveedores mock/deshabilitados. Runner comprueba nombre, propósito, proyecto, puertos, mounts y destinos explícitos antes de toda suite con escritura. Se sobrescribieron las etiquetas Compose heredadas por la imagen MinIO, conforme a Phase3.

Fixtures borran únicamente filas/objetos sintéticos propios de la DB/bucket de prueba. No se ejecutó Compose sobre habituales, force-recreate, down -v, eliminación de volúmenes, limpieza comercial ni cambios de credenciales reales. Al terminar se detuvieron sólo los dos contenedores propios tras verificar etiquetas/mounts; ambos volúmenes se conservaron. Servicios habituales siguen con CreatedAt/StartedAt/mounts iguales a la medición de cierre Phase3. Esto no acredita cero escrituras concurrentes del POS activo ni identidad fila por fila; no se leyó su contenido comercial en esta fase.

Los formatos físicos oficiales siguen **58 y 80 mm**. Sin diff en plantilla térmica/renderers/declaración A4 ni migraciones históricas. Se preservan Luhn de nuevas escrituras, RBAC, sesiones, auditoría, transacciones, seis medios de pago, múltiples equipos/accesorios, un RECO por IMEI y expediente privado reutilizable. Las pruebas cubren esos flujos relacionados, no cada combinación posible del producto.

## Commits y entrega

1. `18aca9f` — AUD-06 provincia/compartir/captura y regresiones.
2. `f9c4ef7` — AUD-07 representación Prisma y contrato SQL.
3. `9242c99` — AUD-08 revisión explícita de lados DNI.
4. `f84de9c` — AUD-09 opciones efectivas de ticket y regresiones UI.
5. `67875fe` — AUD-10 aceptación histórica y trazabilidad existente.

Commit posterior de entrega: documentación/evidencia final. Listado exacto de archivos en evidence/changed-files.txt; historial y fuentes operativas sanitizadas preservados. Secretos/.env/claves, node_modules y respaldos privados no se versionan. Los reportes de fases anteriores se conservan; sólo se actualizan estados actuales/links en auditoría 00/11/12/13.

Push: **NO**. Deploy: **NO**. Base/bucket comerciales: **sin operaciones de escritura de esta fase**. Proveedores reales/hardware: **NOT VERIFIED**.

## Pendientes y siguiente fase

AUD-01/02/03 conservan resolución local previa; AUD-04 **PARCIAL** (custodia real, aceptación y medición representativa RPO/RTO); AUD-05 **BLOQUEADO EXTERNO**. AUD-06–10 satisfacen los criterios técnicos locales anteriores; AUD-11 **P3 ABIERTO**, sin trabajar en esta fase. Revisión autorizada de históricos, fotos antiguas dudosas, hardware 58/80/A4 y proveedores externos no se declaran completados.

Siguiente paso recomendado: aceptación operativa de AUD-04 y checklist externo de AUD-05 en staging autorizado, con responsables y evidencia; AUD-11 puede planificarse por separado. No comenzar otro alcance ni desplegar automáticamente por cerrar P2. [Acciones concretas](08-pending-actions.md).

**NO PRODUCTION READY.** La autorización de esta fase permitió P2 local aun con gates operativos pendientes; no equivale a aceptar esos riesgos para producción.
