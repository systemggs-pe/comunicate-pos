# Respaldo y restauración oficial — aceptación local

## Entorno y destinos

Se creó el proyecto exclusivo `communicate-phase3-20261020`, sin Compose. Contenedores `communicate-test-phase3-20261020-postgres` y `communicate-test-phase3-20261020-minio`, loopback 55436/59030 y dos volúmenes nombrados nuevos (`...-pgdata`, `...-s3data`). El preflight comprueba propósito, proyecto, puerto, nombre y mounts; rechaza montajes comerciales. Evidencia: `isolated-resources.json` y preflight de cada log.

Origen: `communicate_pos_phase9_load`, bucket `communicate-evidence-phase9-load`, exclusivamente sintéticos. Destino: DB nueva `communicate_pos_restore_p3_<identificador>` y bucket nuevo `communicate-evidence-restore-p3-<identificador>`, en los mismos servicios aislados. Credenciales nuevas de prueba, proveedores mock/deshabilitados. No se utiliza ninguna base, volumen o bucket comercial como destino. Recursos recuperados, archivos cifrados y clave sintética separada se conservan para inspección; no se elimina nada.

## Procedimiento ejecutado

1. Preparar fixture válido mediante las APIs locales del producto en el entorno nuevo: 1.000 clientes, 40 equipos, 80 IMEI, 20 ventas, 40 RECO, 40 assets y 40 documentos. No hay operadores externos ni worker en estos recursos.
2. Activar mantenimiento **sólo en el API del fixture**: liveness 200, GET privados/export/readiness 503 y POST 503. Comprobar AuditLog/AuthRateLimit/ventas sin cambios bajo mantenimiento. Drenar y cerrar ese API; no detener el POS habitual.
3. Esperar 125,017 segundos para las ventanas de firmas/cargas. No basta con pasar un booleano sin hacer la pausa real.
4. Ejecutar en proceso nuevo la CLI oficial: `node node_modules/tsx/dist/cli.mjs scripts/backup.ts create --confirm-quiesced`, con BACKUP_DATABASE_URL, BACKUP_BUCKET, BACKUP_DIRECTORY y BACKUP_PASSPHRASE exclusivamente sintéticos. Variables/secretos no se imprimen ni se pasan en argv.
5. Verificar con verifyBackup el manifest AES-256-GCM, hash del dump en streaming, longitud y SHA-256 de cada objeto cifrado. La clave está fuera del directorio del backup; el archivo no contiene su texto plano.
6. Comprobar clave incorrecta y manifest alterado en una **copia sintética separada**: la CLI rechaza ambos antes de crear DB/bucket. No se altera el respaldo válido.
7. Recuperar la clave sintética desde su archivo separado en procesos nuevos y ejecutar `node node_modules/tsx/dist/cli.mjs scripts/backup.ts restore`, con destino nuevo y RESTORE_CONFIRM_DATABASE exacto.
8. Comprobar tablas, importes, relaciones, sesiones/counters revocados, apertura/descarga autorizada, acceso anónimo 403, sesión anterior 401, usuario sin permiso 403 y continuación de secuencias. La repetición sobre el destino existente es rechazada.
9. Reconciliar en lectura ambos buckets con el manifest y descargar **sólo objetos sintéticos** para comprobar todos los checksums. Origen y destino tienen 80 objetos: **40 finales + 40 staging**. Los temporales no se borran para ocultar diferencias.

No se ejecutaron scripts cloud, uploads externos, retención destructiva, DROP DATABASE, rm, down ni eliminación de volúmenes. No se hizo copia de fotografías comerciales dentro del respaldo sintético.

## Resultado e integridad

| Concepto | Origen / respaldo | Restauración / comprobación |
|---|---:|---|
| Tablas públicas | 23 | Conteos iguales, salvo Session/AuthRateLimit que se revocan deliberadamente |
| Clientes / IMEI / ventas | 1.000 / 80 / 20 | Coinciden antes de los pasos posteriores de prueba de acceso/secuencia |
| Importe de ventas | S/ 2.005,00 | Coincide exactamente |
| Assets READY / documentos cliente | 40 / 40 | Identificadores y propietarios coherentes |
| RegistrationEvidence / asociaciones totales | 80 / 120 | Dos enlaces RECO por asset; documento cliente conservado |
| Objetos físicos del manifest | 80 | 80 en origen y 80 en destino; ninguna clave adicional o faltante |
| Finales / staging | 40 / 40 | Se recuperan ambos tipos de objeto conforme al contrato oficial |
| Checksums físicos cotejados al finalizar | 80 origen + 80 destino | Todos SHA-256/tamaño coincidentes |
| Objetos sin referencia conocida en el manifest | 0 | Cero |
| Sesiones anteriores | Snapshot con sesión de prueba | Revocadas antes del nuevo login; cookie anterior rechazada |

El respaldo oficial incluye staging por diseño. Un asset READY y sus dos referencias RECO no equivalen a tres archivos, y el número de READY tampoco equivale al total de objetos que el backup preserva.

## Mediciones locales

| Medición | Resultado |
|---|---:|
| Espera de quiescencia | 125.017 ms |
| CLI backup:create | 3.535 ms |
| CLI backup:restore | 7.968 ms |
| Desde invocar restore hasta comprobaciones de acceso/relaciones/serie | 8.515 ms |
| Bytes de objetos sin cifrar, según manifest (no incluye dump DB) | 16.840 |
| Última venta sintética creada | 20/10/2026 17:06:30.379 UTC |
| Manifest del respaldo verificado | 20/10/2026 17:12:00.918 UTC |
| Antigüedad de esa última escritura al snapshot | 330.539 ms |

No se detectó pérdida de datos sintéticos verificados. El origen se mantuvo sin escritores. La antigüedad refleja también el intervalo entre intentos del guion; no es una frecuencia de respaldo garantizada. Las fotos sintéticas son pequeñas y el almacenamiento/red son locales. **Estos números no acreditan RPO/RTO productivos**, detección/cutover/rollback, tiempos de copia externa ni volumen representativo del destino final.

## Errores de verificación y cómo se resolvieron

- Intento 1: el guion generó un nombre de bucket de 77 caracteres. La comprobación HEAD recibió 400 en vez del 404 esperado para un nombre válido inexistente. Fue un error de configuración del ensayo. Se acortaron nombres y se añadieron límites de longitud para bucket/DB. El respaldo creado se conservó; no hubo restore aprobado en ese intento.
- Intento 2: la CLI create/restore y 18 controles posteriores pasaron. La última expectativa del guion decía «40 objetos fuente» y encontró 80. El manifest ya incluía los 40 staging, como permite el procedimiento. Se corrigió la comparación del guion para usar el manifest, y se ejecutó una **conclusión enfocada de sólo lectura**, sin otro backup/restore: 80/80 claves y checksums por cada bucket. No se cambió código comercial ni se borró staging.
- La comprobación final de metadata comercial usó inicialmente List.LastModified contra HEAD.LastModified, cuya representación HTTP pierde precisión subsegundo. Se comparó LIST contra LIST y tamaño con HEAD, sin descartar la comprobación temporal. El estado final coincide; no era una modificación del objeto. Ver notas de verificación.

Los dos intentos detenidos y sus códigos 1 se conservan, no se convierten retroactivamente en ejecuciones CLI con código 0. El resultado técnico consolidado se apoya en los pasos aprobados y en la conclusión enfocada, todos identificados. Los campos de medición del primer intento no se toman como prueba de una restauración completada.

Evidencia: `official-cli-drill-attempt1.json/.log`, `official-cli-drill-attempt2.json/.log`, `official-cli-drill.json/.log`, `official-cli-final-verification.json`, `cli-focused-verification.log`. Hay 19 controles consolidados, sin sumar reejecuciones; 32 unitarias relacionadas se reejecutaron y pasaron. No se repitieron las 770 pruebas.

## Custodia y automatización

La clave sintética se recuperó desde un directorio separado por procesos nuevos, sin argv ni Git. Eso prueba separación y posibilidad de lectura local; no custodia independiente de una clave operativa, revisión de ACL Windows, gestor externo, suplente ni recuperación ante pérdida del host.

La política de retención anterior sigue propuesta, no aprobada. Los scripts de cifrado/publicación/status y las plantillas de timers existen; no demuestran instalaciones o alertas recibidas. No se inspeccionaron ni utilizaron credenciales productivas cloud, ni se ejecutó transporte native-authorized/B2. Backup local cifrado y restore aislado: PASS técnico; backup externo/restore productivo/automatización: NOT VERIFIED.
