# Phase 10A — Checklist10B y recuperación

Pasos cloud MODIFICAN recursos y exigen autorización10B. Nada aprovisionado/publicado10A. No push/deploy.

1. Responsables infraestructura/costos/secrets/legal/hardware; revisar cuotas en cuenta.
2. Oracle alta/tarjeta sólo manual autorizado; A1 AlwaysFree/home region/capacidad. Falta capacidad BLOCKED, sin paid fallback.
3. Control dominio registrable app/API y DNS: sin ello cookies same-site BLOCKED. No comprar automáticamente.
4. Neon Free/PG16 staging vacío, pooled/direct/TLS/pool, backup/revisión SQL y deploy11 autorizado. Sin copiar datos operativos.
5. R2 checkout autorizado, Standard/bucket privado/token scope/cifrado/CORS; fotos sintéticas/expiry/shared/ref deletion.
6. B2 privado/keys independientes/caps/lifecycle versiones, AES custodia separada y capacidad estimada; backup/restore aislado completo. Retención sólo aprobada.
7. VM UbuntuARM64/Node24/Caddy/usuarios/limits/journal/firewall/SSH. systemd verify/Caddy validate, health/readiness/auth/RBAC/CSRF/503/SIGTERM.
8. Pages Direct Upload manual autorizado, API HTTPS/same-site/CSP/SPA/assets404/no secrets/login/logout/CSV/fotos/PDF; sin Git Integration automática.
9. Worker instalar/habilitar sólo10B; lock/PARTIAL/FAILED/expiry/retries/alertas. Ningún cambio comercial.
10. Aprobar backup diario/pausa125s+quiet/retención/alert26h/restore30d y RPO/RTO real medido. No timer backup activado10A.
11. Smoke proveedores reales/CA/policies/cifrado/cuotas y evidencia fechada; privacidad/DNI real/impresoras48/80/A4/cámara. Operación10C tras resolver bloqueos.

## Incidentes y rollback

Oracle caído: revisar Console/reclamación/proceso/firewall/disco. VM perdida: reconstruir release/env custodiada/worker sólo autorizado, reconectar DB/R2; datos no deben depender VM. Siempre shape free eligible, sin carga artificial.

Neon caído:503, sin confirmaciones ficticias ni retry ciego de escrituras. Revisar cuota/pool/CA/estado; reintentar lecturas y operaciones idempotentes tras recuperar.

R2 caído: no false-positive guardado; mantener outbox/referencias READY, worker reintenta. No borrar metadata por fallo transitorio.

B2 caído: FAILED visible, conservar copia cifrada local y previa; no borrar última copia ni afirmar backup exitoso.

Rollback código: maintenance+worker pausa, current→release anterior probado, reiniciar/smoke. Esquema11 intacto; no reset/db push. Incidente datos: restore aislado DB+R2, checksums/links/RBAC/Decimal/sesiones revocadas y ledger de borrados; aprobar cutover después, nunca overwrite operativo. Conservar evidencia sanitizada y copias válidas.
