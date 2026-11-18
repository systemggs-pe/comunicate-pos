# MinIO — Reconstrucción del incidente

Se revisaron el informe P1, `06-isolation-incident.md`, sus mediciones posteriores y el código histórico. No se repitió la orden ni se reinició el MinIO habitual para investigar.

## Hechos y cronología UTC

- El volumen actual `communicate-pos_evidence_data` fue creado el 10/10/2026 a las 21:15:42, antes del incidente. El bucket operativo conserva fecha de creación 10/10/2026 21:16:15.
- A001/A002 fueron creados/verificados el 18/10 a las 19:45 UTC; sus objetos conservan LastModified de ese momento. Son anteriores a la recreación del contenedor actual.
- El código de prueba anterior incluía `docker compose up -d --force-recreate --wait ... minio`, con el proyecto habitual. La fase P1 informó que esta dependencia se ejecutó y recreó el servicio antes de ser detectada.
- Los artefactos nativos conservan una suite con el caso antiguo fallido a las 20:08–20:09 del 19/10 y otra con el caso antiguo aprobado a las 20:15–20:16. El contenedor actual `communicate-pos-minio-1` fue creado el 19/10 a las 20:18:25. **No se conserva una correspondencia completa de cada invocación con cada recreación**: no se identifica aquel último comando al milisegundo ni se inventa un número exacto de reinicios. Ver `evidence/incident-test-timeline.json` y `baseline.json`.
- La medición posterior del 19/10, 20:20:51, registró dos assets/documentos y coincidió con el baseline. Los dos archivos fueron comprobados por tamaño/SHA-256.
- El 20/10 a las 15:46 arrancó el contenedor actual; ese StartedAt ya existía antes de esta fase. No se atribuye ese arranque a la recreación del día anterior.
- El IMEI adicional se creó el 20/10 a las 15:51:57; su auditoría IMEI_CREATE corresponde al mismo identificador internamente. Los dos assets/documentos adicionales se crearon a las 16:10:44; coinciden con CLIENT_DOCUMENT_UPLOADED y una consulta CODART_PHOTO_LOOKUP de dos imágenes. Se inspeccionaron registros existentes; esta fase no llamó a CODART.

## Alcance confirmado y límites

| Pregunta | Evidencia / conclusión |
|---|---|
| Operación previa al incidente | Orden Compose heredada documentada y reconocida en P1; caso antiguo en resultados de integración |
| Contenedor afectado | Servicio habitual `communicate-pos-minio-1`; la fecha Created actual es posterior al comienzo de P1 |
| Volumen esperado | Montaje actual `/data` → `communicate-pos_evidence_data`; nombre/fecha del volumen coinciden con Compose. Los dos objetos más antiguos y el bucket conservan fechas anteriores al contenedor |
| Cambios de mounts/rutas | El montaje actual es correcto. No hay un inspect anterior completo para demostrar identidad de todos los mounts en cada recreación |
| Configuración del bucket | Hoy privado por ausencia de política pública y HEAD anónimo 403; sin versionado/lifecycle. No hay baseline de políticas para afirmar que nunca cambiaron |
| Recreación de contenedor | Informada por P1 y consistente con Created/orden heredada. No se infiere un conteo exacto de recreaciones |
| Pérdida/recreación de volumen | No hay evidencia de recreación del volumen actual: fue creado antes del incidente. No existe inventario histórico completo que permita demostrar ausencia universal de pérdida en otros volúmenes |
| Inaccesibilidad temporal | Una recreación interrumpe el proceso; no se conservó una sonda continua para medir duración ni clientes afectados |
| Escrituras durante el incidente | Los metadatos/auditoría consultados no demuestran escrituras documentales comerciales en esa ventana. No hay log S3 de auditoría completo para demostrar ausencia de cualquier escritura |
| Integridad observada | Cuatro objetos iniciales con SHA-256/tamaños coincidentes. Al cierre hay seis objetos y ocho referencias: los dos nuevos de 17:18 sólo tienen verificación de presencia/tamaño/metadata. No certifica todos los buckets históricos |

## Prevención comprobada

La imagen `communicate-pos-minio:7aac2a2` contiene etiquetas Compose heredadas `project=communicate-pos`, `service=minio`; los contenedores antiguos de pruebas las heredaron. Es un riesgo confirmado de identificación de recursos, no evidencia adicional de pérdida. No se modifica esa imagen ni los contenedores habituales.

En esta fase se sobrescriben las etiquetas con el proyecto `communicate-phase3-20261020`; hay propósito, nombres, puertos y dos volúmenes nombrados exclusivos. El preflight comprueba esos valores antes de cualquier escritura sintética y rechaza un montaje `communicate-pos_*`. No se ejecuta Compose, rm, down, vaciado ni limpieza. Los recursos sintéticos se conservan detenidos para revisión.

La guarda de reinicio introducida en P1 sigue comprobando nombre, etiqueta de propósito y puerto. La guía de recuperación ahora exige revisar también proyecto y mounts: nunca iniciar, recrear, detener o limpiar el servicio habitual desde scripts de prueba.
