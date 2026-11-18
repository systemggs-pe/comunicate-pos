# Acciones pendientes y siguiente fase

## Para aceptar AUD-04

1. **Custodia real:** designar custodio y suplente; guardar la clave operativa en un gestor/canal independiente del host y del backup, revisar acceso/ACL y demostrar que el operador puede recuperarla sin usar una copia previamente cargada en el proceso. Registrar fecha, responsable y resultado; nunca enviar la clave al chat ni al informe. El archivo sintético de este ensayo no es una clave operativa aprobada.
2. **Objetivos y ensayo representativo:** el dueño del negocio debe aceptar pérdida máxima de datos (RPO) y tiempo de recuperación (RTO). La propuesta previa de una hora/cuatro horas no se considera aprobada. Definir volumen, intervalo real de backups, detección del incidente, descarga/custodia, hardware/red y verificación antes de cutover. Repetir medición en staging autorizado representativo y registrar si cumple. Los tiempos locales de 04-backup-restore.md no son un SLA productivo.
3. **Retención y responsables:** aprobar política y recuperación de claves para copias retenidas, registrar último restore y decidir cómo reaplicar eliminaciones posteriores al snapshot antes de activar un entorno restaurado. No limpiar buckets históricos sin inventario, respaldo y autorización específica.

La aceptación debe ser explícita, fechada y respaldada por evidencia; no se da por realizada una actuación manual que nadie ejecutó.

## Pendientes relacionados

- Catalogar responsables y bases de origen de los 30 buckets no operativos observados. Los nombres y extensiones sugieren pruebas/backups/restores, pero eso no acredita su contenido, retención ni validez. No se autoriza borrar los 83 objetos.
- Adoptar en toda provisión futura de pruebas la comprobación de etiquetas Compose, propósito, puertos y mounts; la imagen MinIO actual hereda etiquetas del proyecto habitual. No modificar los contenedores antiguos para simular que ya estaban aislados correctamente.
- Conservación forense limitada: faltan inspect/logs históricos completos anteriores a cada recreación y sonda de disponibilidad/S3 audit durante el incidente. No se puede reconstruir número exacto de recreaciones, downtime ni ausencia absoluta de escrituras en aquella ventana.

## AUD-05 y P2/P3

AUD-05 sigue BLOQUEADO EXTERNO: hosting/DNS/TLS, secretos/custodia, backup externo, automatización, alertas recibidas, monitoreo y rollback reales. No se crea infraestructura ni se usan servicios o credenciales cloud en esta fase.

AUD-01/02/03 conservan el cierre local documentado en P1; no se vuelven a certificar las 770 pruebas. Permanecen abiertos AUD-06–10 (P2) y AUD-11 (P3). No se modifica UI, negocio, históricos ni tickets; 58/80 mm se conservan.

**Siguiente fase recomendada:** completar y registrar la aceptación operativa de AUD-04 antes de declarar superado este gate previo a P2. No se inicia P2 aquí. Un responsable podría autorizar correcciones P2 locales en paralelo, conservando explícitamente el riesgo pendiente y NOT READY; no se infiere esa decisión ni se autoriza producción.
