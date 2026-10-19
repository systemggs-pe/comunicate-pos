# Backups y recuperación

19/10/2026, America/Lima. HEAD `2751768cf07febf2e0ea7287cf34161fcb445239`. Auditoría sin correcciones.

## Código revisado

recovery.ts implementa AES-256-GCM/manifiesto/hashes, objetos confirmados y exigencia quiesced; destino nuevo y revocación de sesiones al restaurar. Local usa docker compose pg_dump/pg_restore, native-authorized valida Neon/autorización. Publicador cloud contempla verificación/retención/protección de última copia. No se ejecutó acción cloud.

## Ejecución real y límite

1. Suite del producto intentada: BLOCKED por RECOVERY_LOCAL_DATABASE_REQUIRED al usar PostgreSQL aislado 55434. No se cambió a 55432 para sortear la protección. AUD-04.
2. Sonda manual independiente: pg_dump de base sintética, cifrado AES-256-GCM, rechazo de alteración, descifrado en memoria y pg_restore a base nueva aislada.
3. Copia a otro bucket y checksum de dos objetos. Coinciden cantidades en nueve tablas: Client, Equipment, Imei, Sale, SaleEquipment, RegistrationRequest, EvidenceAsset, RegistrationEvidence, ClientDocument.
4. Revocación manual de sesiones en el destino: cero sesiones después. Nunca se restauró sobre la base comercial.

Recuperados: 1002 clientes sintéticos, cuatro equipos, cinco IMEI, una venta, tres RECO y dos documentos/fotos. Dump de 138608 bytes. No contiene fotos comerciales. Clave efímera no publicada: el artefacto de sonda no es una copia operativa para usar después.

**La sonda valida primitivas y consistencia sintética; NO acredita restoreBackup() del producto, transporte cloud, copia externa, scheduler o custodia real de claves.**

## Operación pendiente

RPO/RTO no definidos/aprobados ni medidos para incidente productivo. Duración de una sonda pequeña no fija RTO. Demostrar automatización, alerta de backup ausente, recuperación de claves, retención aprobada, restore periódico y pausa efectiva de todos los escritores; el booleano quiesced no demuestra la pausa por sí solo.

Mantener gate abierto hasta probar la ruta operativa elegida con relaciones/checksums/sesiones y registrar responsables, tiempo y cutover/rollback. Un archivo enc generado no basta.
