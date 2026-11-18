# Incidente de aislamiento durante AUD-03

Una prueba preexistente en tests/integration/evidence.test.ts incluía docker compose up --force-recreate minio con el servicio habitual fijado. Se ejecutó durante las comprobaciones antes de identificar esta dependencia. Esto recreó el contenedor MinIO habitual; se conservó su volumen. Fue un error de aislamiento y no debe describirse la fase como si no hubiera afectado ese servicio.

Corrección: el test ahora exige RECOVERY_MINIO_CONTAINER con prefijo de pruebas, comprueba la etiqueta purpose=p1-remediation y que el puerto publicado coincida exactamente con el endpoint aislado. Sólo entonces reinicia ese contenedor por su nombre explícito. Se retiró la orden Compose. No vuelve a recrear el servicio habitual. También se corrigió la limpieza de fixtures entre suites: las relaciones de evidencia y expediente se eliminan en el entorno de pruebas antes de sus registros comerciales, respetando las claves foráneas.

Comprobaciones posteriores, de sólo lectura:

- Los conteos comerciales coinciden con el baseline: 603 clientes, 641 equipos, 643 IMEI, 576 ventas, 118 solicitudes, dos archivos y dos documentos.
- Los dos archivos READY del MinIO habitual fueron descargados en memoria y comprobados contra el tamaño y SHA-256 almacenados: 2/2 íntegros.
- No se realizaron escrituras de datos comerciales, cambios de roles/credenciales reales, borrado de volúmenes o restauraciones sobre recursos habituales.

Evidencia: commercial-read-only-counts.json y commercial-storage-integrity.json. Los conteos no equivalen a un hash exhaustivo de todas las filas; la integridad de los dos archivos sí se comprobó por checksum. El incidente y sus límites se mantienen visibles en el informe final.

## Verificación adicional al retomar el 20/10/2026

La consulta READ ONLY final observa 644 IMEI, frente a los 643 del baseline y de la comprobación posterior al incidente del 19/10. Al retomar los demás conteos permanecían iguales. Al cierre (16:14 UTC) también se observan cuatro assets y cuatro documentos, frente a dos de cada uno en las comprobaciones anteriores. No se ha investigado ni modificado ese IMEI adicional y no se atribuye su origen: la aplicación habitual ha permanecido disponible entre sesiones. Por tanto, no se afirma igualdad exhaustiva con el baseline al cierre. Se conservan ambas mediciones (`*-post-incident.json` y los registros finales). El GET al retomar verificó 2/2 archivos; el GET final verifica 4/4 archivos por tamaño y SHA-256, sin escrituras.
