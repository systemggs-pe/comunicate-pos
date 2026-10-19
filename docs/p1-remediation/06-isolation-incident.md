# Incidente de aislamiento durante AUD-03

Una prueba preexistente en tests/integration/evidence.test.ts incluía docker compose up --force-recreate minio con el servicio habitual fijado. Se ejecutó durante las comprobaciones antes de identificar esta dependencia. Esto recreó el contenedor MinIO habitual; se conservó su volumen. Fue un error de aislamiento y no debe describirse la fase como si no hubiera afectado ese servicio.

Corrección: el test ahora exige RECOVERY_MINIO_CONTAINER con prefijo de pruebas, comprueba la etiqueta purpose=p1-remediation y que el puerto publicado coincida exactamente con el endpoint aislado. Sólo entonces reinicia ese contenedor por su nombre explícito. Se retiró la orden Compose. No vuelve a recrear el servicio habitual. También se corrigió la limpieza de fixtures entre suites: las relaciones de evidencia y expediente se eliminan en el entorno de pruebas antes de sus registros comerciales, respetando las claves foráneas.

Comprobaciones posteriores, de sólo lectura:

- Los conteos comerciales coinciden con el baseline: 603 clientes, 641 equipos, 643 IMEI, 576 ventas, 118 solicitudes, dos archivos y dos documentos.
- Los dos archivos READY del MinIO habitual fueron descargados en memoria y comprobados contra el tamaño y SHA-256 almacenados: 2/2 íntegros.
- No se realizaron escrituras de datos comerciales, cambios de roles/credenciales reales, borrado de volúmenes o restauraciones sobre recursos habituales.

Evidencia: commercial-read-only-counts.json y commercial-storage-integrity.json. Los conteos no equivalen a un hash exhaustivo de todas las filas; la integridad de los dos archivos sí se comprobó por checksum. El incidente y sus límites se mantienen visibles en el informe final.
