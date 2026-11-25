# Verificación del candidato para tienda

Ejecutar con una instancia de preproducción y expedientes ficticios. Registrar para cada prueba la fecha, el commit, el resultado y una evidencia sin datos personales. El estado del proveedor y el listado de recursos se comprueban con la cuenta operativa.

## Acceso y documentos

1. Publicar en preproducción el frontend del candidato y arrancar la API en Linux ARM64 con sus variables privadas. Aplicar las migraciones con la conexión directa y comprobar el reinicio, HTTPS, `/api/health` y `/api/readiness` con una cuenta autorizada. Abrir y recargar `/boletas-extranjeras`, `/boleta`, `/foto-dni` y `/configuracion/empresa`. Abrir la segunda ruta sin sesión.
2. Verificar el inicio de sesión con correo y contraseña, la revocación de sesión y los permisos con los roles asignados al personal. Si se usa CODART, probar la consulta autorizada y el ingreso manual ante un fallo.
3. Si se pierde acceso al único superadministrador activo, desde el host ejecutar `node build-server/scripts/recover-admin.mjs` con `RECOVERY_ADMIN_DATABASE_URL`, `RECOVERY_ADMIN_EMAIL` y `RECOVERY_ADMIN_NEW_PASSWORD` suministradas en el entorno privado del proceso. Verificar el destino antes de ejecutar. El comando cambia la contraseña de una cuenta activa existente, revoca sus sesiones y registra la recuperación. Retirar las variables de la sesión al terminar y comprobar login con la nueva clave.
4. En Registros, usar el filtro **Movistar sin declaración**. Abrir la edición, seguir hasta Evidencias y adjuntar el PDF correspondiente al IMEI. Comprobar que el RECO descargado contiene la declaración y pesa menos de 400 000 bytes. Revisar por separado cada IMEI de un registro doble.
5. Probar una venta y su edición, un registro doble, boletas, descarga de RECO e impresión térmica de 58 y 80 mm en las impresoras de tienda. Verificar los registros en PostgreSQL y la privacidad del almacenamiento.

## Respaldo y reversión

1. Configurar la frecuencia de respaldo y la custodia independiente de su clave según [el procedimiento de respaldo externo](phase-10a-backblaze-backups.md). Verificar que la ejecución programada produzca una copia completa y que una copia ausente o fallida genere la alerta operativa.
2. Descargar una copia externa y restaurarla a una base y un bucket dedicados. Conciliar los conteos, los checksums y los vínculos. Probar un RECO Movistar, una boleta original, un DNI y los roles en el destino recuperado. Registrar cuánto tiempo transcurre hasta que se puede volver a operar y cuántas transacciones quedarían fuera por la antigüedad de la copia.
3. Ensayar la reversión con el candidato y la versión anterior en preproducción. Poner el entorno en mantenimiento, detener el worker y cambiar al release anterior. Probar salud, login, venta y registro contra el esquema migrado antes de quitar mantenimiento. Si la versión anterior no es compatible con el esquema nuevo, validar el destino restaurado antes de cambiar el tráfico.
4. Confirmar que el worker acepta una boleta con original válido y avisa al retirar una copia de prueba. Revisar las salidas de preflight y de la suite de navegador del mismo commit.
