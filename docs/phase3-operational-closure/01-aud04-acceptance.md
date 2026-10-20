# AUD-04 — Aceptación operativa

Fecha: 20/10/2026. Baseline de esta fase: master `d7c32733be301ac50caeed8cf3cd7ee11ac8be6f`.

La fuente de verdad es el hallazgo original en `docs/production-audit/11-findings-register.md`, conservado también en el snapshot 0ee3e53. Descripción exacta: **«El procedimiento de restore incluido no quedó verificado en aislamiento.»** Evidencia original: `docs/production-audit/evidence/integration-results.json`; las suites rechazaron el puerto aislado 55434 con RECOVERY_LOCAL_DATABASE_REQUIRED. El transporte fijaba 55432 y Docker Compose; no se usó la base comercial para sortearlo.

La fase P1 corrigió el perfil local con RECOVERY_POSTGRES_CONTAINER + RECOVERY_POSTGRES_PORT y verificó createBackup/restoreBackup. Esta fase comprueba además la CLI oficial, la pausa de escritores sintéticos y la recuperación de su clave en procesos nuevos. No se sustituye la ruta del producto por un dump/restore manual alternativo.

## Matriz del criterio original

El criterio exacto original es **«Ruta operativa del producto probada, claves custodiadas y RPO/RTO medidos.»** Se descompone por sus tres condiciones reales:

| Condición AUD-04 | Evidencia | Resultado para cierre |
|---|---|---|
| Ruta operativa del producto probada | `evidence/official-cli-final-verification.json`, intentos 1/2 y conclusión enfocada; scripts/backup.ts create/restore, cifrado, manifest, destinos nuevos, tablas, objetos, relaciones y acceso | PASS LOCAL consolidado, con dos detenciones del guion documentadas; ver 04-backup-restore.md |
| Claves custodiadas | Clave exclusivamente sintética separada del archivo, recuperada por procesos nuevos; no hay evidencia de custodio independiente, gestor/off-host, ACL revisada y recuperación operativa de la clave real | FAIL PARA CIERRE / NO ACREDITADO. La prueba local no sustituye custodia operativa |
| RPO/RTO medidos | Tiempos locales, fecha de último dato sintético y fecha del manifest en el simulacro. Los objetivos 1 h/4 h de la guía previa siguen siendo una propuesta, sin aceptación del negocio ni ensayo representativo del destino final | PASS de medición local; FAIL PARA CIERRE productivo / NO ACREDITADO |

FAIL PARA CIERRE significa ausencia de la evidencia exigida, no un fallo reproducido de restauración ni pérdida de datos. Los resultados técnicos concretos se separan en el informe principal.

**Estado final: PARCIAL.** No se marca RESUELTO. Para cerrar faltan las acciones concretas de 05-pending-actions.md. AUD-05 continúa BLOQUEADO EXTERNO; no se despliega ni se provisiona infraestructura para intentar cerrarlo.

Procedimiento relacionado: `docs/phase-9-backup-restore.md`, `scripts/backup.ts`, `server/ops/recovery.ts`. La guía productiva de B2 permanece preparada y NO VERIFICADA; no se ejecutó transporte cloud.
