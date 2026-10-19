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
