# Matriz final de readiness y gates

19/10/2026, America/Lima. HEAD auditado `2751768cf07febf2e0ea7287cf34161fcb445239`. Sin correcciones funcionales.

PASS local solo cubre el alcance indicado; nunca equivale a certificación productiva.

| Área | Estado | Evidencia/límite |
|---|---|---|
| Arquitectura | PARTIAL | Capas/validación, operación remota sin probar |
| Frontend | PARTIAL | Bundle emitido, TypeScript FAIL |
| Backend | PARTIAL | Bundle/API de muestra; cobertura integral fallida |
| PostgreSQL | PARTIAL | Restricciones/19 migraciones, diferencias e históricos |
| MinIO/S3 | PARTIAL | Muestra local privada aprobada, proveedor remoto pendiente |
| Autenticación | PARTIAL | Controles API; E2E completo no aprobado |
| Google Auth | NOT VERIFIED | Revisión estática sin configuración/prueba real |
| RBAC | PARTIAL | Casos negativos/revocación/jerarquía, no matriz exhaustiva |
| Ventas | PARTIAL | Dinero/idempotencia/edición de muestra |
| Registros | FAIL | DNI obligatorio eludible por bandera opcional |
| Luhn | PASS local acotado | String/formato/checksum/API; no consulta de listas |
| Clientes | PARTIAL | API/UI/expediente de muestra |
| Equipos | PARTIAL | Unicidad y relación/doble IMEI de muestra |
| Gemini | NOT VERIFIED | Sin llamada real |
| CODART | NOT VERIFIED | Sin llamada real; clasificación por posición pendiente |
| PDFs | PARTIAL | Unitarias/generación; integración total/hardware pendiente |
| Tickets | PARTIAL | 58/80 descargados/medidos; físico NOT VERIFIED |
| Reportes | PARTIAL | Código/CSV/ingresos/Lima de muestra |
| UI/UX | PARTIAL | Muestra/foco/Escape y ergonomía |
| Responsive | PARTIAL | 96 observaciones positivas; no todos los pasos/estados |
| Seguridad | PARTIAL | Controles probados; no certificación/pentest completo |
| Performance | PARTIAL | Carga pequeña; capacidad/SLO productivos no verificados |
| Backups | PARTIAL | Código/sonda cifrada manual; operación externa pendiente |
| Restore | PARTIAL | Sonda manual aprobada; producto BLOCKED |
| Observabilidad | PARTIAL | Logs/estados, sin alerta/incidente remoto probado |
| Infraestructura cloud | NOT VERIFIED | Sin evidencia operativa remota |
| Deploy readiness | FAIL | AUD-01–05 y gates externos abiertos |

## Gates antes de aprobar

- [ ] Cero P0 abiertos; reevaluar hallazgos tras cambios.
- [ ] Cerrar P1 AUD-01–05 con evidencia/responsable.
- [ ] Compilación oficial y pruebas críticas completas sobre el mismo HEAD.
- [ ] DNI requerido en servidor, reutilización segura y atomicidad negativa.
- [ ] SQL/Prisma conciliados, migración revisada/ensayada sin retirar garantías.
- [ ] Restore por ruta operativa, claves recuperables y checksums/relaciones/sesiones.
- [ ] RPO/RTO/retención aprobados y medidos con datos representativos.
- [ ] Staging con DNS/TLS/cookies/storage/worker/backup/alertas verificados.
- [ ] Verificar o deshabilitar funciones externas pendientes con fallback aprobado.
- [ ] Privacidad/contratos/autorizaciones revisados por responsables competentes.
- [ ] Hardware físico para funciones obligatorias comprobado.
- [ ] Ensayo de rollback, responsables y autorización de despliegue.

**DECISIÓN: NO DESPLEGAR HOY con la evidencia de este baseline.** Defectos reproducidos, pruebas críticas incompletas y acreditación operativa insuficiente. El aspecto visual y npm audit cero no bastan.

## Índice y reproducción

00–13 cubren ejecutivo/inventario/seguridad/datos/negocio/integraciones/UI/rendimiento/recuperación/deploy/hallazgos/plan/gates. evidence contiene versiones, comandos/resultados, capturas y PDFs solo sintéticos. verification-summary.json separa casos únicos y repeticiones.

Scripts suplementarios conservados como *-source.txt. Para reproducir, copiar a .local con nombre original y preparar de nuevo recursos aislados/credenciales efímeras. Esas credenciales no se publican. No ejecutar fixtures contra la base comercial. La restauración manual es explícitamente distinta del restore del producto.

No se cambió código funcional, datos comerciales, roles/credenciales reales o arquitectura cloud; no hubo push/deploy. Builds locales ignorados por Git. Los contenedores exclusivos de la auditoría se detienen al finalizar; no se detienen servicios comerciales.

## Actualización de fase 2 — 20/10/2026

La matriz anterior corresponde al baseline auditado y conserva su evidencia histórica. La remediación local se verifica sobre el commit `9c23e08e9b1e94b12ad3581cad0a23cc5b630931`; detalle y casos únicos en [informe P1](../p1-remediation/00-remediation-report.md).

| Gate local | Estado actualizado |
|---|---|
| TypeScript / lint | PASS |
| Instalación limpia y builds oficiales frontend/backend | PASS |
| Unitarias | 306/306 PASS |
| Integración | 386/386 PASS |
| E2E normal y MVP | 46/46 + 32/32 PASS, sin pendientes |
| DNI obligatorio / reutilización / atomicidad negativa | PASS LOCAL |
| Tickets 58 mm / 80 mm: vista, PDF y llamada de impresión | PASS LOCAL; hardware NOT VERIFIED |
| Restore por ruta operativa del producto en DB/bucket nuevos | PASS LOCAL |
| Custodia de claves, retención y RPO/RTO productivos representativos | PENDIENTE; AUD-04 no cierra su aceptación completa |
| Infraestructura, backup externo, alertas, monitoreo y rollback reales | BLOQUEADO EXTERNO; AUD-05 |
| Proveedores externos y hardware | NOT VERIFIED |

No se despliega ni se aprueban gates externos a partir de mocks o duraciones sintéticas. Los P2/P3 originales siguen abiertos. El informe P1 documenta el incidente de aislamiento de MinIO y las diferencias de un IMEI y dos assets/documentos en el conteo comercial final; no se certifica igualdad exhaustiva con el baseline.

**DECISIÓN ACTUAL: NO PRODUCTION READY.** Tres P1 resueltos localmente; defecto local de AUD-04 corregido con aceptación operativa pendiente; AUD-05 bloqueado externo.

El manifest de evidencia de la auditoría original corresponde a sus archivos en el snapshot `0ee3e53`. Las actualizaciones posteriores de 00/11/12/13 pertenecen a esta fase; no se reescribe aquel manifest como si fuesen resultados originales. La evidencia final y el manifest de fuentes de fase 2 se conservan en p1-remediation/evidence/.

## Actualización de fase 3 — 20/10/2026

CLI de backup/restore del producto, mantenimiento/drenaje sintético, cifrado/manifest, 23 tablas y 80 objetos (40 finales + 40 staging) verificados localmente. Se reejecutaron 32 casos unitarios relacionados; no las 770 pruebas. Se conserva la evidencia de dos detenciones del guion y su conclusión enfocada de sólo lectura. Bucket operativo inicial: cuatro objetos/checksums correctos y seis asociaciones. Al cierre: seis objetos/ocho asociaciones tras actividad concurrente registrada a las 17:18 UTC; los dos nuevos sólo se verificaron por presencia/tamaño/metadata. Cero objetos desconocidos o referencias sin objeto. Clientes: 603→604; ventas/equipos/IMEI/RECO sin cambio entre snapshots. StartedAt/mounts habituales permanecen iguales; no se afirma ausencia de escrituras del POS activo.

AUD-04: **PARCIAL**, no RESUELTO; falta custodia operativa acreditada y aceptación/ensayo representativo de RPO/RTO. AUD-05: **BLOQUEADO EXTERNO**. Sin cambios P2/P3, UI, tickets, push o deploy. **NOT READY**. [Evidencias y acciones](../phase3-operational-closure/00-summary.md).

## Actualización de fase 4 — P2 local, 20/10/2026

AUD-06–10 satisfacen sus criterios técnicos locales sobre código 67875fe: provincia en captura/compartir, Prisma reconciliado con 19 migraciones intactas (diff 0), fotos sin lado requieren revisión explícita, configuración coherente con ticket fijo y consulta/corrección IMEI histórica protegida. No se repararon los históricos comerciales ni se comprobó CODART real. Se verificaron 322 casos unitarios consolidados (cinco fallos iniciales por alias Python sustituidos por rerun completo de los dos archivos afectados), 302 de integración relacionadas y 6 E2E enfocadas; no se repitió la suite completa de 770. Instalación limpia, build oficial frontend/backend, tsc, lint y validate PASS. Detalle de resultados, fuentes, fallos iniciales y límites en [Phase4 P2 remediation](../p2-remediation/00-remediation-report.md).

AUD-04 sigue PARCIAL, AUD-05 BLOQUEADO EXTERNO y AUD-11 P3 abierto. Custodia/RPO/RTO representativos, infraestructura/backup/alertas reales y hardware siguen pendientes. La autorización de P2 local no acepta riesgos para producción. No se hizo push/deploy ni operaciones comerciales de escritura; servicios habituales conservan CreatedAt/StartedAt/mounts. Los apartados históricos de fases anteriores permanecen como evidencia de sus respectivos baselines. **NOT READY para producción.**
