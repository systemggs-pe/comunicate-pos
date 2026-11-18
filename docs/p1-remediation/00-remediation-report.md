# COMUNIC@TE POS 2.0 — P1 REMEDIATION REPORT

**STATUS: PARTIAL.** Correcciones locales verificadas; no se autoriza ni se ejecuta despliegue. AUD-04 conserva requisitos de aceptación operativa y AUD-05 está bloqueado por evidencia externa.

Fecha: 20/10/2026, America/Lima. Baseline real: master `2751768cf07febf2e0ea7287cf34161fcb445239`. Commit final de código verificado: `9c23e08e9b1e94b12ad3581cad0a23cc5b630931`. Los commits posteriores de entrega sólo agregan documentación/evidencia; su hash se informa al entregar. Informes originales leídos: 00, 11, 12 y 13 de production-audit.

## Hallazgos P1

| ID / estado | Causa y corrección | Archivos principales | Verificación / dependencias |
|---|---|---|---|
| AUD-01 — RESUELTO LOCAL | Contratos null, firma de colores jsPDF, province nullable, claves repetidas y pruebas térmicas antiguas. Se corrigen los consumidores; lockfile sincronizado para instalación reproducible. Sin omitir archivos ni usar ts-ignore. | Login.tsx; receipts/pdf.ts; RegistrationFlow.tsx; OperationalRegistrationFlow.tsx; package-lock.json; tests/unit/receipts.test.ts | TypeScript, lint, npm ci y builds oficiales frontend/backend PASS. Misma plantilla, colores equivalentes y márgenes. DLL Windows del POS en uso evitada mediante checkout de compilación separado. |
| AUD-02 — RESUELTO LOCAL | Un booleano HTTP permitía omitir DNI. El servicio exige siempre frontal/reverso válidos dentro de la transacción; reutiliza el expediente vigente. La bandera antigua no concede exenciones. | server/services/registration-requests.service.ts; shared/workflow.ts; tests/integration/registration-identity-required.test.ts | 8 regresiones incluidas en integración: bandera omitida/false/true, servicio directo, incompleto/vencido/ajeno, reutilización e idempotencia; rechazo sin filas comerciales parciales. No se modifica ningún histórico. |
| AUD-03 — RESUELTO LOCAL | Fixtures Luhn inválidos, contratos UI antiguos, limpieza FK incompleta y dependencia del MinIO habitual. Fixtures sintéticos válidos, documentos reales privados, selectores vigentes y aislamiento explícito. | tests/helpers y tests/e2e; suites unit/integration; manifiesto de archivos adjunto | Suites completas aprobadas; sin skips añadidos ni exclusiones nuevas. Casos únicos y límites en Quality. Proveedores simulados. Incidente de aislamiento detallado abajo. |
| AUD-04 — PENDIENTE DE ACEPTACIÓN OPERATIVA | Puerto/Compose fijados impedían restore aislado. Perfil explícito de contenedor/puerto con validación y guardas de base/bucket nuevos; fixture válido. Defecto local RESUELTO. | server/ops/recovery.ts; scripts/lib/phase9-fixture.ts; tests/unit/phase9.test.ts; tests/integration/recovery.test.ts y client-vault-recovery.test.ts | Restore real del producto PASS en DB/bucket nuevos: importes, archivos compartidos, checksum, RBAC, sesiones, secuencias y no sobrescritura. Custodia recuperable de claves, RPO/RTO y retención productivos requieren responsable y carga representativa; no se da por cerrado el criterio completo. |
| AUD-05 — BLOQUEADO EXTERNO | No hay evidencia operativa productiva acreditada. Se conserva un checklist concreto, sin crear servicios cloud ni simular cierre. | docs/p1-remediation/05-aud-05.md; registro original de hallazgos | Pendientes hosting, DNS/TLS, secretos/custodia, backup externo, timers/worker, alertas recibidas, monitoreo, restore remoto, rollback y aprobación operativa. |

Detalle por ID: [AUD-01](01-aud-01.md), [AUD-02](02-aud-02.md), [AUD-03](03-aud-03.md), [AUD-04](04-aud-04.md), [AUD-05](05-aud-05.md). El registro original 11 y los gates 13 incluyen el estado actual sin borrar los resultados históricos del baseline.

## Quality

| Comprobación final | Resultado |
|---|---|
| TypeScript | PASS, cero diagnósticos |
| Lint | PASS, cero errores/warnings |
| Instalación limpia + build frontend y backend | PASS |
| Unit | 306/306 PASS, 0 fallidas, 0 pendientes |
| Integration | 386/386 PASS, 0 fallidas, 0 pendientes |
| E2E normal | 46/46 PASS, 0 fallidas, 0 pendientes |
| E2E MVP | 32/32 PASS, 0 fallidas, 0 pendientes |
| Casos de entrada únicos, sin sumar reintentos | **770 PASS / 0 FAIL / 0 pendientes** |
| Pares archivo/título distintos | 751; las otras 19 filas son parametrizaciones it.each |
| Fuentes durante la verificación | 311 archivos con SHA-256 sin cambios |

El conteo único usa archivo + nombre + fila parametrizada dentro de una sola ejecución final. Son 770 casos de entrada y 751 pares archivo/título distintos: 19 filas adicionales provienen de tablas `it.each` unitarias cuyo título omite el parámetro. Los reintentos, subconjuntos AUD-02/restore/tickets y ejecuciones anteriores fallidas no se suman como cobertura nueva. Las observaciones responsive tampoco son casos unit/integration adicionales. Historial resumido y fuentes exactas: evidence/verification-summary.json.

Regresiones cubiertas: sesión/CSRF/RBAC y revocación, protección del último superadmin, permisos documentales, dinero decimal e idempotencia, integridad/rollback, Luhn y unicidad, doble IMEI con segundo celular distinto, DNI obligatorio/reutilización, clientes/equipos, reportes/CSV, declaración A4 y evidencias privadas. Las pruebas históricas preparan estados pre-vault sólo en fixtures aislados; no hay excepción nueva en backend.

Compatibilidad térmica: únicamente 58 mm y 80 mm de papel. Las pruebas comprueban ancho físico del PDF, selección/cancelación, vista automática, descarga al elegir tamaño, plantilla aprobada, serie/barcode que cabe respetando módulo mínimo e invocación de impresión sin controles visibles. No se sustituye 58 por 48 ni se cambian márgenes. **Impresión física: NOT VERIFIED.** Una serie larga que no cabe al módulo mínimo es un límite del formato, no se reduce su legibilidad para hacer pasar la prueba.

La compilación limpia usa .local/p1-clean-build con los archivos fuente rastreados y una URL de DB ficticia no accesible. No copia .env ni detiene el motor Prisma cargado por el POS. Advertencias de anotaciones Rollup/dependencias no impiden la compilación; no se presentan como pruebas de producción.

## Datos y aislamiento

Todas las escrituras de aplicación de las pruebas usan PostgreSQL 55435 y MinIO 59020, API 3002/frontend 5175, con nombres dedicados. Se aplicaron las 19 migraciones existentes a una base vacía de pruebas; **no se alteraron migraciones históricas, esquema ni datos comerciales para corregir los P1**. Las credenciales efímeras y .env privados no forman parte de la entrega.

Restore: createBackup/restoreBackup reales, no sólo una sonda manual. Se restauran 1000 clientes sintéticos, 80 IMEI, 20 ventas por 2005.00, 40 fotos/80 vínculos; se rechazan archivos ausentes/corruptos, bases/buckets existentes y destinos fuera de allowlist. Las duraciones locales de los tests no constituyen compromisos RPO/RTO ni prueba de custodia externa.

**Incidente conocido:** una prueba heredada ejecutó Compose y recreó el MinIO habitual conservando el volumen antes de detectarse la dependencia. Se sustituyó por reinicio del contenedor de pruebas con comprobación de nombre, etiqueta y puerto. No se oculta este impacto al servicio. La comprobación posterior del 19/10 coincidió con los conteos originales y verificó 2/2 archivos por SHA-256; el 20/10 se verificaron dos archivos al retomar y cuatro al cierre, todos íntegros. [Registro del incidente](06-isolation-incident.md).

La consulta final READ ONLY observa 603 clientes, 641 equipos, **644 IMEI**, 576 ventas, 118 solicitudes, **cuatro assets y cuatro documentos**. Hay un IMEI, dos assets y dos documentos más que en el baseline y en la comprobación del 19/10; no se investigó ni atribuyó el origen de estas diferencias ni se modificaron datos para forzar igualdad. La aplicación habitual permaneció disponible entre sesiones. Se conservan ambas mediciones. Los conteos agregados no certifican igualdad fila por fila. No se afirma “PostgreSQL idéntico al baseline” ni “MinIO nunca tocado”.

No se modificaron usuarios/roles/credenciales reales ni se eliminaron volúmenes. No hubo llamadas reales a Google/Gemini/CODART ni consumo autorizado de créditos. Los PASS de mocks no verifican contratos/proveedores reales.

## Entrega y reproducción

- Commit inicial: `2751768cf07febf2e0ea7287cf34161fcb445239`, master.
- Commits locales por bloque: evidence/commits.txt.
- Archivos modificados desde el baseline: evidence/changed-files.txt. No se agregan .impeccable/, output/ ni tmp/ preexistentes.
- Documentación: este informe, fichas 01–06, registro/gates originales y resultados sanitizados en evidence/.
- Git al finalizar: cambios de la fase confirmados localmente; los archivos ajenos sin seguimiento se preservan. Ver evidence/git-status.txt para el snapshot previo al commit de entrega.
- Push: **NO**. Deploy/provisión cloud: **NO**.

Reproducción: preparar DB PostgreSQL loopback `communicate_pos_test` y MinIO privados dedicados, variables de pruebas y proveedores mock; aplicar migraciones sólo allí. Los tests comprueban el nombre de DB. Para recuperación configurar puerto+contenedor juntos y nombres/buckets sintéticos nuevos; para reinicio MinIO la etiqueta `purpose=p1-remediation` debe coincidir. Nunca copiar destinos comerciales.

Comandos de calidad: `tsc --noEmit`; `eslint .`; `npm ci`, `npm run build`, `npm run build:api` en la copia limpia; Vitest `--project unit` y `--project integration`; Playwright normal y `--config playwright.mvp.config.ts`. Las ejecuciones con escritura se hicieron secuencialmente sobre el entorno aislado, no sobre el POS habitual.

## Pendientes y decisión

P1: AUD-04 conserva aceptación operativa externa; AUD-05 BLOQUEADO. No se declaran los cinco resueltos. P2 abiertos: AUD-06 provincia al compartir, AUD-07 conciliación SQL/Prisma, AUD-08 clasificación por posición sin contrato externo probado, AUD-09 preferencias incompatibles con plantilla fija y AUD-10 revisión autorizada de IMEI históricos. P3 abierto: AUD-11 comodidad táctil. Ninguno se cierra incidentalmente por actualizar una expectativa de test.

Google Auth, Gemini, CODART y hardware térmico/A4: NOT VERIFIED en entorno real. Staging, HTTPS, backups externos recuperables, monitoreo/alertas, RPO/RTO, custodia, rollback y aprobación siguen requeridos.

**NO PRODUCTION READY.** Las correcciones locales y sus pruebas no sustituyen la evidencia operativa ni autorizan desplegar.
