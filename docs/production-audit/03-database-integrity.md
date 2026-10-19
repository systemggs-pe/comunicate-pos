# PostgreSQL, Prisma e integridad

Fecha: 19/10/2026, America/Lima. Baseline: master `2751768cf07febf2e0ea7287cf34161fcb445239`. Solo auditoría y diagnóstico.

## Estado comercial solo de lectura

Transacción SET TRANSACTION READ ONLY: 603 clientes, 641 equipos, 643 IMEI, 576 ventas, 118 RECO, dos assets/dos documentos. Solo cantidades agregadas; sin exportar identidades, valores IMEI o fotos. 70 IMEI no superan Luhn; no se corrigieron.

Cero diferencias entre Sale.total y suma de líneas/accesorios menos descuento. Cero assets READY sin referencias RegistrationEvidence/ClientDocument. No equivale a examinar cada anomalía histórica ni a comprobar cada objeto comercial físico en S3. No se descargaron fotos reales.

## Integridad y transacciones

Revisión de PK/FK, DNI/IMEI únicos, slot 1–2, unicidad equipo/slot, venta única por equipo físico, claves de idempotencia, completado de RECO y guards SQL documentales. Hay restricciones de ámbito/inmutabilidad/dimensiones READY y referencias separadas para archivos compartidos.

Dinero con Decimal. Servicios usan Serializable y reintentos P2034 acotados. Se comprobaron venta concurrente sin duplicado, dos RECO/un equipo, edición con conflicto y una sola transición. No se afirma cobertura de todas las intercalaciones.

## Migraciones y drift

migrate status: 19 aplicadas y ninguna pendiente en la base comercial; no se aplicaron allí durante la auditoría. Las 19 se aplicaron desde cero en PostgreSQL aislado.

migrate diff devuelve exit 2: defaults, acciones de claves foráneas y único (operationId, phone). Algunas garantías SQL intencionales no aparecen completamente en Prisma. AUD-07 exige conciliación/revisión: **no ejecutar automáticamente el SQL generado para eliminar el drift**.

margin58 usa @map sobre columna física margin48: decisión explícita de compatibilidad, no defecto por sí sola. La última migración de formatos no se reejecutó en la base comercial.

Históricos anómalos requieren revisión documental autorizada; nunca reparar checksums en lote. Luhn no informa robo, bloqueo o lista blanca. Búsqueda/lectura histórica separadas de nuevas escrituras. Estudio de locks/migraciones a gran escala y ensayo de migración productiva quedan pendientes.

Evidencias: anonymized-commercial-statistics.log, migration-status.log, migration-drift.log, isolated-migrations.log y comprobaciones suplementarias.
