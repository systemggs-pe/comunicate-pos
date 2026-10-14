# MVP 01: estado de las integraciones

La implementación local de escaneo Gemini, consulta CODART y expediente documental
está completada. Los contratos externos se prueban con respuestas controladas que
la interfaz identifica como simuladas. Gemini real y CODART real permanecen
NOT VERIFIED; no se hicieron solicitudes externas ni se modificaron credenciales.

- [01A — Escaneo y concurrencia](mvp-01a-verification.md).
- [01B — Nombre completo y fotografías CODART](mvp-01b-verification.md).
- [01C — Expediente documental, privacidad y referencias](mvp-01c-verification.md).
- El reporte de cierre documenta los resultados finales y sus límites.

El cliente puede revisar documentación privada, descargar, reemplazar y eliminar
asociaciones con permisos. El registro permite reutilizar identidad vigente sin
copiar archivos; las fotografías de equipos mantienen su scope original.

Las APIs permanecen desactivadas por defecto. Las claves sólo se configuran en
backend. La consulta de fotografías exige habilitación contractual para almacenar,
autorización explícita, finalidad y referencia. La clasificación frontal/reverso
requiere intervención humana, sin inferirla del orden de respuesta.

Se conserva la restauración anterior a Tacna y la primera importación: 603 clientes,
641 equipos, 643 IMEI, 576 ventas y 118 registros. Antes de las dos migraciones
aditivas de esta entrega se creó un respaldo cifrado en `.local/` y se compararon
los hashes de todas las filas comerciales y configuraciones; no cambió ninguna.

No hubo push ni deploy. Los respaldos y herramientas privadas siguen excluidos
de Git. `output/` y `tmp/` permanecen ajenos a la entrega.
