# Conciliación PostgreSQL ↔ MinIO

Inventario inicial: 20/10/2026 17:01 UTC. Fuente: `evidence/storage-inventory.json` y `reconciliation-details.json`. PostgreSQL se consulta con REPEATABLE READ, READ ONLY; MinIO sólo LIST/HEAD y cuatro GET acotados en memoria por inventario (los mismos cuatro objetos iniciales, comprobados de nuevo al cierre). No se descargan fotografías masivamente, no se guardan fotos comerciales ni se publican claves de objetos, nombres de archivos, DNI o IMEI. Las identidades de assets se representan por A001–A004 y una huella de UUID.

## Cantidades comparables del inventario inicial

| Fuente | Concepto | Esperado | Observado | Diferencia | Explicación / conciliación |
|---|---|---:|---:|---:|---|
| PostgreSQL → bucket operativo | Objetos finales de EvidenceAsset READY | 4 | 4 | 0 | Cada storageKey esperado está presente; tamaño coincide |
| PostgreSQL / MinIO | Checksum SHA-256 de esos cuatro archivos | 4 | 4 | 0 | Coincidencia al descargar sólo esos cuatro en memoria |
| PostgreSQL | RegistrationEvidence | 2 | 2 | 0 | Dos enlaces a RECO existentes |
| PostgreSQL | ClientDocument | 4 | 4 | 0 | Cuatro documentos CURRENT vigentes |
| PostgreSQL | Referencias activas totales | 2 + 4 | 6 | 0 | Asociaciones, no archivos físicos |
| PostgreSQL | Assets con referencias | 4 | 4 | 0 | A001/A002 tienen un documento y un enlace RECO cada uno; A003/A004 tienen un documento cada uno |
| Bucket operativo | Objetos sin correspondencia conocida | 0 | 0 | 0 | No hay candidatos a huérfanos físicos en este bucket |
| PostgreSQL | READY sin objeto | 0 | 0 | 0 | Ninguna referencia física faltante |
| PostgreSQL | Assets sin referencias activas / sin referencia alguna | 0 | 0 / 0 | 0 | No se confunde ausencia de RECO con ausencia de documento cliente |
| PostgreSQL / bucket operativo | PENDING/FAILED/DELETING / staging físico | 0 | 0 / 0 | 0 | Sin cargas incompletas ni intentos de borrado pendientes observados |
| Instancia MinIO completa | Todos los buckets / todos los objetos | No equivale a cuatro assets operativos | 31 / 87 | No aplica | El bucket operativo tiene cuatro; otros 30 buckets contienen 83 objetos que pertenecen a otros namespaces/contextos |

Los 83 objetos de otros buckets **no se declaran huérfanos** comparándolos con la base operativa. Hay 12 namespaces cuyo nombre sugiere backup, 16 restore, uno test y dos no clasificados (incluido el operativo). Se identifican 45 archivos con sufijo de cifrado y 15 marcadores complete; sólo son indicios de formato/propósito, no certificados de recuperabilidad o propiedad. Los nombres de los otros buckets se sustituyen por alias estables de esta enumeración. Sus cantidades/tamaños/versiones figuran individualmente en la evidencia. No se borra ni se descifra ninguno.

Total de bytes iniciales de la instancia: 4.097.981; bucket operativo: 1.544.180. Versionado no habilitado y cero delete markers en los 31 buckets observados. Las cantidades no se explican por versiones ocultas actuales. Queda pendiente catalogar propietarios, bases de origen y retención de los buckets ajenos; no se presenta como pérdida confirmada ni se ejecuta limpieza.

## Diferencias temporales explicadas

| Momento / concepto | Anterior | Posterior | Evidencia de la diferencia |
|---|---:|---:|---|
| IMEI, 19/10 → 20/10 antes de 15:53 | 643 | 644 | Fila creada 15:51:57.796 y evento IMEI_CREATE 15:51:57.808, con identificador coincidente internamente |
| Assets/documentos, 20/10 15:53 → 16:14 | 2 / 2 | 4 / 4 | Dos assets READY + documentos creados 16:10:44; sus IDs coinciden con los eventos de subida y la consulta registrada de dos imágenes |
| Objetos operativos / referencias activas, inventario inicial | 4 | 6 | Diferentes conceptos: archivo compartido por ficha y trámite. No hay dos archivos faltantes |

A003/A004 pertenecen al mismo cliente según metadatos y proceden de CODART_DNIV. Se demuestra el tipo de operación registrado, **no quién la realizó físicamente ni una atribución humana completa**. No se hizo consulta externa durante la investigación.

## Integridad relacional

- 34 claves foráneas validadas; cero huérfanos en RegistrationEvidence→asset/RECO, ClientDocument→asset/cliente, RECO→IMEI e IMEI→equipo.
- Cero discrepancias de ownerClientId respecto al cliente del documento o al propietario del equipo vinculado al RECO.
- Cero enlaces de RECO cuya categoría carezca de un documento del mismo asset con esa categoría. EvidenceAsset.category=IDENTITY_IMAGE puede diferir de DNI_FRONT/BACK del vínculo: el contrato de client-vault.ts usa un asset físico genérico y una clasificación lógica del documento; no es por sí solo corrupción. No se modifica AUD-08.
- Documentos CURRENT no vencidos; cero referencias a assets DELETING y cero intentos de borrado pendientes en la muestra completa del bucket operativo.
- La consistencia de IDs no prueba que la persona fotografiada sea el cliente; eso requiere revisión documental autorizada.

## Los cuatro archivos de P1

P1 registró cuatro archivos READY en la base local y comprobó longitud + SHA-256 contra EvidenceAsset. Hoy se vuelven a comprobar los cuatro, accesibles con credenciales locales autorizadas y denegados anónimamente con 403. Los dos primeros conservan creación/verificación/LastModified del 18/10; los otros dos, del 20/10 a las 16:10.

P1 preservó resultados agregados, no un manifiesto con IDs y hashes individuales exportados. Por ello no hay demostración criptográfica longitudinal independiente de que cada byte histórico nunca cambió. La verificación SHA-256 sí coteja los cuatro objetos del inventario inicial con sus metadatos; no incluye los dos objetos creados posteriormente. No se extiende ese PASS a los otros 30 buckets.

Las mediciones DB y S3 son sucesivas; la aplicación habitual no se pausó y no hay snapshot distribuido atómico. Una última comparación de estado se documenta al cerrar. No se ejecutó reparación automática.

## Cierre con aplicación activa — 17:20:08 UTC

La aplicación habitual no se pausó. Los conteos coincidían a las 17:15–17:17; después se registraron dos documentos DNI_FRONT/BACK, fuente CODART_DNIVEL, a las 17:18:33, con eventos CLIENT_DOCUMENT_UPLOADED concordantes y consulta registrada de dos imágenes. Se observa además 604 clientes frente a 603 y un evento CLIENT_CREATED. Son operaciones registradas concurrentes; no se atribuye su autoría humana ni se hicieron consultas externas desde estos guiones.

| Concepto | Inicial 17:01 UTC | Cierre 17:20 UTC | Resultado |
|---|---:|---:|---|
| EvidenceAsset / READY / objetos operativos | 4 / 4 / 4 | 6 / 6 / 6 | Presencia y tamaño concordantes |
| RegistrationEvidence / ClientDocument | 2 / 4 | 2 / 6 | Dos documentos nuevos, sin nuevo enlace RECO |
| Referencias activas | 6 | 8 | Asociaciones, no ocho archivos físicos |
| Objetos desconocidos / READY faltantes | 0 / 0 | 0 / 0 | Sin discrepancia observada |
| SHA-256 cotejado por esta fase | 4 | Los cuatro iniciales | Los dos nuevos NO VERIFICADOS por checksum; sólo LIST/HEAD/metadata |
| Bytes del bucket operativo | 1.544.180 | 2.777.820 | Incremento de 1.233.640 bytes |
| Instancia completa, buckets / objetos | 31 / 87 | 31 / 89 | Los otros 30 buckets conservan 83 objetos |

Fuentes: storage-inventory-closing.json, baseline-closing.json, reconciliation-details.json y final-state.json. Los cuatro assets iniciales conservan estado/updatedAt/tamaño/LastModified; contenedores habituales conservan CreatedAt/StartedAt/mounts. El total de bytes de la instancia al cierre es 5.331.621. No se presenta la comparación como un snapshot distribuido atómico ni como ausencia universal de escrituras. No se descargaron los documentos nuevos.
