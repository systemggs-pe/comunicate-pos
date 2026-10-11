# Phase 9 — Respaldo y recuperación

## Alcance comprobado

`npm run test:recovery` crea un respaldo de datos sintéticos en `communicate_pos_phase9_load`, restaura a una nueva base `communicate_pos_restore_<uuid>` y un bucket privado nuevo `communicate-evidence-restore-<uuid>`. Nunca usa la base operativa como fixture ni borra bases/buckets existentes. Los entornos recuperados se conservan para inspección; su eliminación futura requiere identificar explícitamente el recurso sintético.

La prueba conserva 1.000 clientes, 40 equipos, 80 IMEIs, 20 ventas con total exacto 2.005,00 y 40 solicitudes. Una foto común se recupera con dos links de RECO. Comprueba migraciones/tablas, relaciones, secuencias, checksum SHA-256 después de descargar, acceso anónimo 401, SELLER 403, link de otra solicitud 404, bucket anónimo 403 y sesión previa revocada. La restauración repetida rechaza el destino ya existente.

## Formato y seguridad

`database.enc` contiene un `pg_dump --format=custom --no-owner --no-privileges` PostgreSQL 16, cifrado durante el streaming, sin dump SQL/archivo plano temporal. Los objetos y `manifest.enc` se cifran individualmente mediante AES-256-GCM, sal aleatoria y scrypt, IV aleatorio y tag de autenticidad. Manifest cifrado v1: fecha, hashes SHA-256, conteos de tablas, claves de objetos, tamaños y tipo MIME. Incluye final y staging; no depende de ETag ni de referencias locales inexistentes. Tamaño máximo 10 MiB por imagen, máximo 100.000 objetos. DB se procesa en streaming; una imagen a la vez reside en memoria.

Passphrase privada de mínimo 32 caracteres; usar secreto aleatorio administrado separado del respaldo, no una frase publicada. No versionar, colocar en argumentos, imprimir, enviar por chat ni dejar en historial. Directorio restringido al operador; los resultados de prueba están en `.test-results/phase9/` ignorado por Git. Esta protección no sustituye ACL, controles del host ni cifrado del disco.

Verificación criptográfica y checksums de todos los archivos antes de crear recursos. Un backup no se marca completo si falta una foto READY o su tamaño/checksum físico no coincide con los metadatos de PostgreSQL. También se cotejan esos metadatos después de restaurar DB. Prueba real negativa: archivo ausente y archivo físicamente corrompido son rechazados. Restore requiere confirmación exacta del nombre de DB, loopback:55432 y prefijos aislados; no existe DROP, opción de overwrite ni restauración directa sobre `communicate_pos`. Conteos verificados antes de revocar sesiones. Se revocan Session y AuthRateLimit para no reactivar accesos de un snapshot viejo; usuarios y roles permanecen. Un error posterior a crear el destino deja el entorno parcial aislado para investigación; no se publica ni se declara recuperado.

## Procedimiento local explícito

1. Detener nuevas escrituras: configurar `MAINTENANCE_MODE=true`, reiniciar el API local y comprobar que los POST rechazan con 503. Pausar trabajadores/scripts de limpieza. Esperar solicitudes activas y ventanas de firmas/verificación (mínimo 125 s después de la última carga; ampliar si existe trabajo activo). El flag bloquea todo el API privado (incluidos GET que actualizan sesiones/auditoría); sólo permanece público el liveness. No puede controlar otro proceso operador. `--confirm-quiesced` es una afirmación operativa obligatoria, no un detector mágico de snapshots coherentes.

   Verificar también GET privados con503 y liveness200: exportaciones/descargas y autenticación de lectura pueden generar auditoría o actualizar sesión. No permitirlos durante el snapshot. La regresión comprueba que AuditLog/AuthRateLimit no cambian bajo mantenimiento.
2. Por un medio privado, definir `BACKUP_DATABASE_URL`, `BACKUP_BUCKET`, `BACKUP_DIRECTORY` nuevo y `BACKUP_PASSPHRASE`. DB debe ser local aprobada, storage loopback. El directorio padre debe existir; el destino no puede existir. No copiar valores reales a esta guía.
3. Ejecutar `npm run backup:create -- --confirm-quiesced`. Exigir salida PASS con número de tablas/objetos y código 0. Si falta manifest, el respaldo es incompleto. Reanudar escrituras sólo después de comprobar finalización y desactivar mantenimiento.
4. Con el mismo directorio/passphrase, configurar `BACKUP_DATABASE_URL` para una DB nueva `communicate_pos_restore_<identificador>`, `BACKUP_BUCKET=communicate-evidence-restore-<identificador>` y `RESTORE_CONFIRM_DATABASE` igual al nombre exacto. Ejecutar `npm run backup:restore`.
5. Verificar resultado, ejecutar prueba de apertura del expediente, autorización y descarga/checksum. Mantener el entorno aislado hasta revisar datos eliminados posteriormente al snapshot. Nunca cambiar el POS operativo automáticamente hacia un restore.

Requisitos locales: Docker Compose del proyecto con PostgreSQL 16 y MinIO saludables, Node y dependencias instaladas. Los comandos Docker usan el canal local del contenedor, sin contraseñas en sus argumentos. Los scripts deliberadamente rechazan hosts externos: **no son una automatización productiva**.

## Plan productivo pendiente

Propuesta inicial para aprobar con operaciones: RPO 1 hora y RTO 4 horas; DB con PITR y respaldo horario, respaldo completo conjunto diario, objetos versionados/replicados a cuenta externa privada. Retención propuesta: 7 diarios, 4 semanales y 3 mensuales, sujeta a finalidad/legal y capacidad. Realizar simulacro mensual y después de cambios de esquema/proveedor. Esos objetivos no están garantizados por el pequeño simulacro local.

Para PostgreSQL administrado usar conexión **directa** con TLS y verificación de certificado, `pg_dump/pg_restore` versión compatible y secretos fuera de CLI; no el pool transaccional del API. El operador debe instalar y validar este transporte productivo, seleccionar una estrategia consistente entre DB y versiones de objetos, y automatizar cifrado, copia externa, retención, alerta de fallo/antigüedad y restauración completa. No tratar un dump DB como backup de fotografías. S3/R2 versioning no es por sí mismo un backup externo.

Registro mínimo de cada ejecución: hora, ID de snapshot, versión de esquema, hashes/conteos y resultado; sin datos personales. Proteger tanto respaldos como clave; ensayar recuperación de la clave. Umbrales propuestos: alertar respaldo DB >2 h, copia conjunta >26 h, error o checksum incorrecto inmediato. Responsable y destino externo aún no definidos.

El borrado definitivo en operación no borra fotos presentes en respaldos anteriores. Un restore antiguo exige reaplicar el registro de eliminaciones/retención y revocar sesiones antes de habilitarlo. Revisión jurídica y procedimiento externo de borrados: pendientes.

Producción: **NOT VERIFIED**. Ninguna copia externa, scheduler, RPO/RTO productivo o política de retención fue instalada en esta fase.
