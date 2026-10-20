# COMUNIC@TE POS 2.0 — FULL PRODUCTION AUDIT

Fecha: 19/10/2026, America/Lima. Baseline: master `2751768cf07febf2e0ea7287cf34161fcb445239`. Solo auditoría y diagnóstico.

## Estado general y decisión

**NOT READY. ¿Es seguro desplegar hoy? NO con la evidencia disponible.** Hay defectos reproducidos y gates de producción abiertos. Funcionar en varios recorridos locales no acredita un release recuperable en producción. No se corrigió código funcional, no se cambiaron datos/roles/credenciales comerciales, no se desplegó y no se hizo push.

## Baseline real

- Rama master; HEAD `2751768cf07febf2e0ea7287cf34161fcb445239`.
- Git inicial: sin cambios rastreados; `.impeccable/`, `output/`, `tmp/` sin seguimiento, conservados.
- Node 24.21.0; npm 11.19.0; PostgreSQL comercial local 16.15; Prisma 6.19.3; Docker Server 29.8.2.
- 19 migraciones aplicadas; storage local MinIO, imagen `communicate-pos-minio:7aac2a2`.
- Servicios comerciales: API 3001, frontend 5173, PostgreSQL 55432 y storage 59000. No recibieron pruebas de escritura.
- Aislamiento: contenedores independientes PostgreSQL 55434/MinIO 59010; bases distintas para suites y comprobaciones suplementarias; API/vista suplementarias 3004/5176. APIs pagadas deshabilitadas o simuladas.

## Hallazgos

**P0 confirmados: 0 · P1: 5 · P2: 5 · P3: 1 · Total: 11.** Se distinguen defectos reproducidos, riesgos estáticos y gates por falta de evidencia. Cero P0 descubiertos no certifica ausencia de riesgos críticos.

## Calidad y pruebas reales

| Comprobación | Resultado |
|---|---|
| TypeScript | FAIL: 12 diagnósticos, cinco archivos |
| ESLint | PASS, sin warnings |
| Prisma validate | PASS |
| Migraciones | 19 aplicadas; diferencias datasource/datamodel por conciliar |
| Build oficial npm run build | FAIL por EPERM del motor Prisma bloqueado en Windows; tsc independiente también falla |
| Bundle Vite / backend esbuild | Ambos generados; no equivalen a build oficial aprobado |
| npm audit | 0 vulnerabilidades conocidas reportadas; 587 dependencias en el informe |
| Unitarias únicas, último resultado por caso | 299: 275 aprobadas, 24 fallidas |
| Integración | 378 registradas: 122 aprobadas, 246 fallidas, 10 pendientes |
| E2E normal + MVP | 76 registradas: 7 aprobadas, 16 fallidas, 53 sin concluir |
| Comprobaciones suplementarias | 28: 26 aprobadas, dos defectos reproducidos |
| Total único concluido | **718: 430 aprobados, 288 fallidos** |
| Pendientes / sin concluir | 63; nunca contados como PASS |
| Muestra responsive | 96 observaciones cargadas: 16 vistas × seis anchos, cero overflow horizontal/pageerror |

Los reintentos PDF tras configurar Python y la validación de imagen tras confirmar reemplazo sustituyen el resultado anterior del mismo caso: no inflan el total. Los fallos de fixtures no son automáticamente defectos comerciales distintos. Las observaciones de navegador y solicitudes de carga se contabilizan aparte. Detalle: `evidence/verification-summary.json`.

## Seguridad y negocio

Comprobados: sesión requerida, rechazo CSRF por Origin, actor forjado, permisos restrictivos, documento consultado con clientId ajeno, storage anónimo denegado, revocación al desactivar y protección del último superadmin. Ningún valor de secreto configurado apareció en los 61 archivos de artefactos escaneados. No equivale a pentest ni certificación.

Venta concurrente con igual clave: una única venta y respuestas consistentes. Dos equipos/accesorios: S/ 120.25 exactos. Edición concurrente: 200/409. Registro doble: dos RECO/un equipo. DNI manual persistido y reutilizado automáticamente en otro trámite. Una sola transición de finalización concurrente.

Fallos confirmados: POST directo permite crear RECO sin DNI obligatorio si omite requireIdentityPhotos; compartir sustituye provincia por departamento. Tickets 58/80 descargados y medidos; impresión física NOT VERIFIED.

## Datos y recuperación

Consulta comercial READ ONLY: 603 clientes, 641 equipos, 643 IMEI, 576 ventas, 118 RECO, dos assets y dos documentos. 70 IMEI históricos no superan Luhn. Cero diferencias entre total y líneas/accesorios/descuento; cero assets READY sin enlaces. No se corrigieron históricos ni se exportaron sus identificadores.

Restore manual independiente: cantidades iguales en nueve tablas y checksums de dos fotos, detección de alteración AES-256-GCM y revocación manual de sesiones. **No acredita restoreBackup() del producto**, bloqueado por el perfil local fijo. RPO/RTO, backup externo y restore cloud siguen sin verificar.

## Integraciones y producción

Google real: NOT VERIFIED, variables OIDC locales no configuradas. Gemini real y CODART real: NOT VERIFIED; no se enviaron fotos reales ni se consumieron créditos. MinIO aislado se comprobó; proveedor remoto, TTL real y cifrado contractual no verificados.

Infraestructura cloud, DNS/HTTPS público, cookies remotas, workers/timers instalados, alertas recibidas, backup externo, rollback ejecutado, hardware, costos/cuotas y límites de cuentas: NOT VERIFIED. Las plantillas y estimaciones previas no son evidencia de recursos contratados o presupuesto vigente.

## Top 10 problemas prioritarios

| Orden | ID / prioridad | Riesgo y ubicación | Evidencia | Corrección necesaria |
|---|---|---|---|---|
| 1 | AUD-01/P1 | Release no compila; Login, registros, PDF, tests | typescript.log | Tipos y build oficial reproducible |
| 2 | AUD-02/P1 | Regla DNI eludible; workflow/service RECO | supplemental-probes.json | Obligatoriedad derivada en servidor |
| 3 | AUD-03/P1 | Cobertura crítica inservible; fixtures/selectores | verification-summary.json | Datos válidos y suites completas |
| 4 | AUD-04/P1 | Recuperación operativa sin demostrar; recovery.ts | integration-results.json | Restore del producto aislado |
| 5 | AUD-05/P1 | Operación cloud no acreditada; ops/configuration | configuration-readiness.log | Staging, backup, alertas, rollback |
| 6 | AUD-06/P2 | Ubicación equivocada; registration-share.ts | supplemental-probes.json | Provincia correcta en tres formatos |
| 7 | AUD-07/P2 | Futura migración retira garantías; schema/migrations | migration-drift.log | Conciliar Prisma y SQL |
| 8 | AUD-08/P2 | Caras DNI inferidas; codart.ts | Código, API real no probada | Contrato probado o revisión humana |
| 9 | AUD-09/P2 | Opciones sin efecto; CompanySettings/receipt | Código y tests | Alinear controles con plantilla aprobada |
| 10 | AUD-10/P2 | Históricos requieren revisión; IMEI | Estadísticas READ ONLY | Corrección autorizada caso por caso |

[AUD-11 y registro completo](11-findings-register.md) incluyen líneas/funciones, reproducción, impacto, probabilidad, aceptación y estado. No se implementó ninguna remediación.

## Plan de remediación

Fase 1: atender cualquier P0 nuevo y mantener congelado el despliegue. Fase 2: resolver P1 de compilación/regla documental/cobertura/recuperación/operación. Fase 3: P2 y revisión autorizada de históricos. Fase 4: verificaciones externas y legales. Fase 5: staging aceptado, ensayo de rollback y despliegue controlado con autorización posterior.

Informes temáticos 01–10, [roadmap](12-remediation-roadmap.md), [matriz y gates](13-final-production-gates.md). Un cambio posterior de HEAD requiere revisar el impacto y repetir comprobaciones afectadas.

## Actualización posterior — fase 2, 20/10/2026

Este documento conserva el diagnóstico y plan del baseline original. La remediación local posterior se detalla en [P1 remediation report](../p1-remediation/00-remediation-report.md). AUD-01/02/03 resueltos localmente; AUD-04 con restore local aprobado y aceptación operativa pendiente; AUD-05 bloqueado externo. No se autoriza producción. El manifest original corresponde al snapshot 0ee3e53, no a estas actualizaciones.
