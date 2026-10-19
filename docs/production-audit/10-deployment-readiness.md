# Infraestructura, operación y despliegue

19/10/2026, America/Lima. HEAD `2751768cf07febf2e0ea7287cf34161fcb445239`. Auditoría sin correcciones.

## Preparación visible

Dockerfile Node24, templates systemd/Caddy/Oracle, Neon/R2/B2, worker con locks/límites, backups/preflights y cabeceras de hosting estático. No se observa pipeline .github en el baseline; un despliegue manual no es automáticamente incorrecto, pero requiere controles verificables.

El entorno inspeccionado es de desarrollo. Sus fallos contra una política productiva no se presentan como filtración ni como prueba sobre una instalación remota. Sin evidencia operativa de recursos contratados. OIDC Google local, BACKUP_PASSPHRASE y WORKER_DATABASE_URL no configurados; sin mostrar valores.

| Elemento | Estado |
|---|---|
| LOCAL READY | PARTIAL: runtime/muestra operativos, tsc/suites fallidos |
| STAGING READY | NOT VERIFIED |
| PRODUCTION READY | NO |
| DNS/HTTPS/CA/cookies remotos/proxy | NOT VERIFIED |
| PostgreSQL remoto/pool/capacidad | NOT VERIFIED |
| Storage privado/cifrado/CORS/TTL remoto | NOT VERIFIED |
| Worker/timers instalados | NOT VERIFIED |
| Logs requestId | Implementados; revisión/muestra local |
| Centralización/métricas/alertas recibidas | NOT VERIFIED |
| Backup externo/restore productivo | NOT VERIFIED |
| Rollback ejecutado/release anterior | NOT VERIFIED |
| Impresora58/80/A4/cámara/lector | NOT VERIFIED |
| Costos/cuotas/límites de cuentas | NOT VERIFIED |

## Observabilidad

observeHttp genera requestId/método/route parametrizada/estado/duración/código sin cuerpo/query/cookie/identidad. Health es liveness; readiness con permiso comprueba DB/storage. Worker informa SUCCESS/PARTIAL/FAILED, cola/orfandad/truncamiento y limita barrido físico a 100 objetos por pasada. PARTIAL requiere procedimiento, no ignorarse.

No se probó fallo→alerta→responsable→recuperación. Backup/worker/proveedor agotado podrían pasar inadvertidos sin consumo de estados. No se midió servicio cloud real.

Cerrar AUD-01–05, probar staging, secretos/TLS/proxy/storage, backup/restore/rollback y responsables antes de liberar. Revisar migración y ensayarla; nunca db push o migraciones destructivas para ocultar diferencias. Documentación de planes no prueba costos ni disponibilidad actual. No se desplegó para llenar vacíos.
