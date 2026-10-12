# Phase 10A — Seguridad y secretos

Cookie Host-only API HttpOnly/Secure/Lax/path/ preservada. credentials=include permite CORS same-site, no convierte pages.dev en mismo site que Oracle. Origin exacto y preflight Content-Type, métodos acotados; sin wildcard ni SameSiteNone. RBAC backend/sesiones/expiración/desactivación conservados. Loopback+Caddy sanitizan X-Real-IP; confianza sólo peer loopback con flag explícito. Dominio/PSL/ownership/CA requiere verificación externa: sameSiteConfiguration es gate conservador, no prueba ownership ni resolver completo PSL.

| Proceso | Inventario |
|---|---|
| Frontend | Sólo VITE_API_BASE_URL pública HTTPS/api |
| API | DATABASE_URL pooled,AUTH_ALLOWED_ORIGINS,DNIURL/token,R2credenciales/TTL,HTTP_LOGGING,MAINTENANCE,TRUST_LOOPBACK_PROXY |
| Worker | DATABASE_URL/WORKER_DATABASE_URL,R2 scoped,BATCH/MAX/TIMEOUT/STATUS/MAINTENANCE; sin DNI/B2 |
| Operador | DIRECT_URL, bootstrap transitorio ADMIN retirado después |
| Backup | BACKUP_DATABASE_URL directa,R2 read/B2 scope,PASSPHRASE,DIRECTORY,MAX_RETAINED_BYTES/RETENTION/STATUS; RESTORE_CONFIRM sólo aislado |

Plantillas ops y .env.example sin secretos reales. .dockerignore excluye env/datos/output/tmp/reports. Env servidor root:communicate0640, directorios privados. AES secreto fuera de B2/copia. No imprimir env/DSN ni argumentos con secretos. Rotación manual autorizada: emitir scope nuevo, probar staging, cambiar servicio y revocar anterior; AES conserva claves para retención. No copiar secretos innecesarios entre procesos ni CI. Proxy sin raw URL logs, journal7d/100MB propuesto.

Fotos DNI privadas/UUID,EXIF/GPS eliminados, scope/checksum. Sin personas reales ni exportar DB local. Backups incluyen datos cifrados sujetos a revisión legal/autorización/retención/encargados. Borrado operativo no elimina versiones/copias: reconciliar ledger antes de activar restore antiguo. Revisión jurídica Phase9 sigue pendiente.

TLS local autofirmado y ignoreHTTPSErrors SÓLO fixture; nunca cliente productivo. Scripts cloud requieren flag explícito. Preflight local no abre cloud. Sin auto-deploy. CSP HTTPS general temporal; restringir destinos reales antes de publicar sin relajar script-src.
