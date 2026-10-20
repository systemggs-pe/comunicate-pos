# Registro de hallazgos

Baseline master `2751768cf07febf2e0ea7287cf34161fcb445239`, 19/10/2026 America/Lima. Sin correcciones en ese baseline. La actualización de fase 2 figura debajo. P0 confirmados: 0; P1: 5; P2: 5; P3: 1. Cero P0 descubiertos no certifica ausencia de vulnerabilidades.

| ID | Severidad | Módulo | Hallazgo |
|---|---|---|---|
| AUD-01 | P1 | Compilación | TypeScript falla con 12 diagnósticos en cinco archivos. |
| AUD-02 | P1 | Registros | La obligatoriedad de fotos DNI depende de una bandera opcional del navegador. |
| AUD-03 | P1 | Pruebas | La suite actual no respalda los flujos críticos del release. |
| AUD-04 | P1 | Recuperación | El procedimiento de restore incluido no quedó verificado en aislamiento. |
| AUD-05 | P1 | Operación productiva | Falta evidencia de infraestructura, respaldo externo y alertas productivas verificados. |
| AUD-06 | P2 | Compartir | Se usa departamento en lugar de provincia. |
| AUD-07 | P2 | Migraciones | El datamodel no describe completamente el estado producido por las migraciones. |
| AUD-08 | P2 | CODART | Dos fotos sin etiquetas se clasifican por índice sin contrato real verificado. |
| AUD-09 | P2 | Configuración | Se ofrecen preferencias de ticket que la plantilla fija ignora. |
| AUD-10 | P2 | Históricos | 70 de 643 IMEI históricos no cumplen Luhn. |
| AUD-11 | P3 | UI táctil | Algunos controles móviles son menores al objetivo de comodidad de 44×44 px. |

## Actualización de fase 2 — 20/10/2026

La evidencia original y sus reproducciones se conservan como historial. Los estados de cada ficha se actualizan con la remediación local, sin modificar los P2/P3. Informe y pruebas: [P1 remediation](../p1-remediation/00-remediation-report.md).

| ID | Estado actual | Evidencia y límite |
|---|---|---|
| AUD-01 | RESUELTO LOCAL | TypeScript, lint e instalación/compilación oficial limpia. |
| AUD-02 | RESUELTO LOCAL | Regla incondicional en servidor; rechazo atómico y reutilización con DNI vigente. |
| AUD-03 | RESUELTO LOCAL | 306 unitarias, 386 integración y 78 E2E aprobadas en el mismo commit, sin pendientes. |
| AUD-04 | PENDIENTE DE ACEPTACIÓN OPERATIVA | Defecto de aislamiento corregido y restore del producto probado; custodia/RPO/RTO productivos pendientes. |
| AUD-05 | BLOQUEADO EXTERNO | Infraestructura, respaldo externo, alertas, monitoreo y rollback no acreditados. |

## AUD-01 — TypeScript falla con 12 diagnósticos en cinco archivos.

- **Severidad/módulo:** P1 / Compilación.
- **Ubicación:** `src/features/receipts/pdf.ts:17`.
- **Evidencia:** `evidence/typescript.log` o código indicado.
- **Reproducción/condición:** Ejecutar tsc --noEmit sobre el HEAD auditado. Errores de null en Login, setFillColor en PDF, propiedades repetidas, province nullable y referencias a 48 mm en pruebas.
- **Impacto:** Bloquea el gate oficial de calidad. Vite/esbuild emiten archivos sin validar estos tipos.
- **Probabilidad/alcance:** Confirmada.
- **Corrección propuesta:** Corregir tipos/contratos y referencias obsoletas sin omitir tsc.
- **Aceptación:** tsc y build oficial limpios en instalación reproducible.
- **Estado:** RESUELTO LOCAL. Ver ../p1-remediation/01-aud-01.md y evidencia final.

## AUD-02 — La obligatoriedad de fotos DNI depende de una bandera opcional del navegador.

- **Severidad/módulo:** P1 / Registros.
- **Ubicación:** `shared/workflow.ts:12; server/services/registration-requests.service.ts:96`.
- **Evidencia:** `evidence/supplemental-probes.json` o código indicado.
- **Reproducción/condición:** POST autorizado con dos IMEI válidos, sin evidence/documentEvidence ni requireIdentityPhotos: 201, dos RECO, cero adjuntos.
- **Impacto:** El usuario autorizado puede eludir la regla documental. No demuestra acceso anónimo ni elevación de permisos.
- **Probabilidad/alcance:** Reproducida con datos sintéticos.
- **Corrección propuesta:** Derivar la obligación en servidor; reutilizar DNI vigente y rechazar atómicamente si falta alguno de sus lados.
- **Aceptación:** Mismo caso sin documentos rechazado sin filas parciales; con DNI guardado válido se adjunta automáticamente.
- **Estado:** RESUELTO LOCAL. Ver ../p1-remediation/02-aud-02.md; históricos sin modificar.

## AUD-03 — La suite actual no respalda los flujos críticos del release.

- **Severidad/módulo:** P1 / Pruebas.
- **Ubicación:** `tests/helpers/workflow.ts:3; tests/unit/receipts.test.ts:8`.
- **Evidencia:** `evidence/verification-summary.json` o código indicado.
- **Reproducción/condición:** Integración: 246 fallidas; E2E: 16 fallidas/53 sin concluir. Numerosos fixtures incumplen Luhn y varios selectores/expectativas son anteriores al rediseño.
- **Impacto:** La lógica posterior al primer rechazo no se prueba. No son automáticamente 246 defectos comerciales distintos.
- **Probabilidad/alcance:** Confirmada.
- **Corrección propuesta:** Actualizar fixtures válidos y expectativas; investigar fallos restantes sin desactivar reglas.
- **Aceptación:** Suites críticas completas, sin pendientes injustificados, sobre el mismo HEAD.
- **Estado:** RESUELTO LOCAL. Suites completas aprobadas sobre 9c23e08; ver ../p1-remediation/03-aud-03.md y ../p1-remediation/evidence/verification-summary.json.

## AUD-04 — El procedimiento de restore incluido no quedó verificado en aislamiento.

- **Severidad/módulo:** P1 / Recuperación.
- **Ubicación:** `server/ops/recovery.ts:18; scripts/lib/phase9-fixture.ts`.
- **Evidencia:** `evidence/integration-results.json` o código indicado.
- **Reproducción/condición:** Las suites del producto rechazan el puerto aislado 55434 con RECOVERY_LOCAL_DATABASE_REQUIRED; el perfil local fija 55432 y usa docker compose. No se apuntó a la base comercial para sortearlo.
- **Impacto:** No hay evidencia actual de recuperación integral por la ruta operativa del producto.
- **Probabilidad/alcance:** Bloqueo confirmado; pérdida real no reproducida.
- **Corrección propuesta:** Preparar perfil explícitamente aislado conservando allowlists y probar restore DB/objetos/sesiones/checksums.
- **Aceptación:** Ruta operativa del producto probada, claves custodiadas y RPO/RTO medidos.
- **Estado:** PARCIAL (fase 3, 20/10/2026). CLI oficial y restore aislado comprobados, integridad del bucket operativo conciliada; custodia operativa y aceptación/medición representativa de RPO/RTO aún no acreditadas. Ver ../phase3-operational-closure/01-aud04-acceptance.md.

## AUD-05 — Falta evidencia de infraestructura, respaldo externo y alertas productivas verificados.

- **Severidad/módulo:** P1 / Operación productiva.
- **Ubicación:** `server/ops/configuration.ts; ops/oracle; ops/worker; ops/backblaze`.
- **Evidencia:** `evidence/configuration-readiness.log` o código indicado.
- **Reproducción/condición:** Entorno inspeccionado de desarrollo; plantillas presentes, sin pruebas de DNS/TLS, Neon/R2/B2, timers instalados, alertas recibidas o restore cloud.
- **Impacto:** Las plantillas no acreditan disponibilidad ni recuperación productiva. No se afirma que no existan recursos contratados fuera del alcance visible.
- **Probabilidad/alcance:** No cuantificable: falta evidencia.
- **Corrección propuesta:** Completar staging autorizado, custodia de claves, worker/backups, alertas y rollback con responsables.
- **Aceptación:** Checklist operativo fechado, aceptado y demostrado antes del despliegue.
- **Estado:** BLOQUEADO / EXTERNAL PENDING. Ver ../p1-remediation/05-aud-05.md.

## AUD-06 — Se usa departamento en lugar de provincia.

- **Severidad/módulo:** P2 / Compartir.
- **Ubicación:** `shared/registration-share.ts:16`.
- **Evidencia:** `evidence/supplemental-probes.json` o código indicado.
- **Reproducción/condición:** Solicitud con province=PROVINCIA AUDIT y department=LIMA: share-text contiene - LIMA y omite la provincia. La agrupación doble tampoco compara provincia.
- **Impacto:** Ubicación distinta a la requerida en la comunicación del trámite.
- **Probabilidad/alcance:** Reproducida.
- **Corrección propuesta:** Incluir provincia en contrato, plantilla y comparación doble; revisar captura en el formulario.
- **Aceptación:** Individual/doble/bloqueado conservan provincia y no agrupan ubicaciones incompatibles.
- **Estado:** REPRODUCIDO. Abierto, sin corregir.

## AUD-07 — El datamodel no describe completamente el estado producido por las migraciones.

- **Severidad/módulo:** P2 / Migraciones.
- **Ubicación:** `prisma/schema.prisma; prisma/migrations`.
- **Evidencia:** `evidence/migration-drift.log` o código indicado.
- **Reproducción/condición:** 19 migraciones aplicadas, pero migrate diff devuelve 2 con defaults/FK y único (operationId, phone). Parte puede ser SQL intencional no representado.
- **Impacto:** Una migración futura podría intentar retirar garantías o cambiar acciones referenciales. No prueba corrupción actual.
- **Probabilidad/alcance:** Diferencias confirmadas; impacto futuro no reproducido.
- **Corrección propuesta:** Conciliar/documentar SQL y Prisma. No aplicar automáticamente el diff para quitar diferencias.
- **Aceptación:** Historia desde base vacía y definición reconciliadas, excepciones intencionales justificadas.
- **Estado:** CONFIRMADO EN METADATOS. Abierto, sin corregir.

## AUD-08 — Dos fotos sin etiquetas se clasifican por índice sin contrato real verificado.

- **Severidad/módulo:** P2 / CODART.
- **Ubicación:** `server/integrations/codart.ts:53`.
- **Evidencia:** código señalado en Ubicación; análisis estático, sin llamada real.
- **Reproducción/condición:** Exactamente dos imágenes sin side/lado: índice 0→DNI_FRONT, 1→DNI_BACK, pese al comentario de no inferir por índice. No se llamó al proveedor real.
- **Impacto:** Si cambia el orden externo, las caras podrían guardarse al revés.
- **Probabilidad/alcance:** Condicional al contrato externo; no medida.
- **Corrección propuesta:** Aportar contrato y prueba autorizada de orden estable o exigir identificación humana del lado.
- **Aceptación:** Sin etiquetas no se confirma un lado sin regla contractual probada o revisión explícita.
- **Estado:** ESTÁTICO / NO REPRODUCIDO CON API REAL. Abierto, sin corregir.

## AUD-09 — Se ofrecen preferencias de ticket que la plantilla fija ignora.

- **Severidad/módulo:** P2 / Configuración.
- **Ubicación:** `src/pages/CompanySettings.tsx:11; shared/receipt.ts`.
- **Evidencia:** código señalado en Ubicación y pruebas de preferencias; análisis estático.
- **Reproducción/condición:** Formulario ofrece contacto/serie/vendedor/pie configurable; receiptRows no usa esas preferencias. La plantilla fija fue solicitada por el usuario.
- **Impacto:** El administrador guarda una opción que no tendrá el efecto esperado.
- **Probabilidad/alcance:** Estático confirmado; test anterior de preferencias falla.
- **Corrección propuesta:** Retirar o aclarar controles no aplicables. No reintroducir contenido retirado sin acuerdo.
- **Aceptación:** Cada opción visible produce un efecto documentado o deja de presentarse como aplicable.
- **Estado:** ESTÁTICO. Abierto, sin corregir.

## AUD-10 — 70 de 643 IMEI históricos no cumplen Luhn.

- **Severidad/módulo:** P2 / Históricos.
- **Ubicación:** `shared/imei.ts:9`.
- **Evidencia:** `evidence/anonymized-commercial-statistics.log` o código indicado.
- **Reproducción/condición:** Consulta SET TRANSACTION READ ONLY con resultados agregados; no se exportan valores.
- **Impacto:** Esos equipos pueden necesitar revisión autorizada antes de un trámite nuevo. Luhn no prueba robo, bloqueo o lista blanca.
- **Probabilidad/alcance:** Anomalía presente; origen individual no investigado.
- **Corrección propuesta:** Revisión documental caso por caso y corrección autorizada con trazabilidad. Nunca reparar checksum automáticamente.
- **Aceptación:** Consulta histórica disponible y nuevas escrituras válidas, sin perder asociaciones.
- **Estado:** HISTÓRICOS INTACTOS. Abierto, sin corregir.

## AUD-11 — Algunos controles móviles son menores al objetivo de comodidad de 44×44 px.

- **Severidad/módulo:** P3 / UI táctil.
- **Ubicación:** `src/design.css:36`.
- **Evidencia:** `evidence/a11y-observations.json` o código indicado.
- **Reproducción/condición:** A 390 px: Buscar IMEI 33×36 y Cerrar sesión 36×36. Foco visible y Escape funcionan.
- **Impacto:** Menor comodidad táctil. No prueba por sí solo incumplimiento WCAG AA.
- **Probabilidad/alcance:** Observada en la muestra.
- **Corrección propuesta:** Ampliar área interactiva conservando apariencia y foco.
- **Aceptación:** Objetivo 44×44 donde corresponda, sin solapamiento/overflow.
- **Estado:** MEDIDO. Abierto, sin corregir.

## Actualización de fase 3 — cierre operativo local

AUD-04 permanece **PARCIAL**, con ruta CLI verificada y custodia/RPO/RTO productivos pendientes. Las diferencias temporales de un IMEI y dos assets/documentos se concilian con creación/auditoría del 20/10; inventario inicial de cuatro objetos/seis asociaciones y cierre de seis objetos/ocho asociaciones tras actividad registrada a las 17:18 UTC. Cero referencias físicas faltantes; SHA-256 cotejado sólo para los cuatro iniciales, los dos nuevos son metadata-only. AUD-05 sigue BLOQUEADO EXTERNO. No se inicia P2 ni se declara producción lista. Ver [reporte fase 3](../phase3-operational-closure/00-summary.md).
