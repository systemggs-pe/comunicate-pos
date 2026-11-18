# COMUNIC@TE POS 2.0 — PHASE 3 OPERATIONAL CLOSURE

**STATUS: PARTIAL. El sistema continúa NOT READY para producción.** El respaldo/restore oficial y la conciliación del bucket operativo quedan verificados localmente. AUD-04 no puede cerrarse completamente: faltan custodia operativa acreditada y objetivos/ensayo productivo de RPO/RTO. AUD-05 permanece bloqueado externamente.

## Baseline y alcance

- Branch: master.
- Starting commit: `d7c32733be301ac50caeed8cf3cd7ee11ac8be6f`, igual al esperado. No se retrocedió el repositorio.
- Código comercial al finalizar: mismo baseline; no cambian src/, server/, shared/, prisma/, scripts/ ni tests/ rastreados. Los guiones exclusivos de inspección/ensayo se guardaron en .local y se preservan como texto fuente en evidence/ para reproducibilidad.
- Commit final de documentación: el que contiene este informe; su hash se entrega en el mensaje final. Git status previo al commit en evidence/git-status.txt; .impeccable/, output/ y tmp/ preexistentes se conservan sin seguimiento.
- Documentos obligatorios leídos: informe P1 00 y fichas 04/05/06; auditoría original 00/11/12/13 y 09-backup-and-restore; guías Phase9/10A y código de recuperación/almacenamiento.
- Inspección habitual: PostgreSQL 127.0.0.1:55432/communicate_pos y MinIO 127.0.0.1:59000, exclusivamente lectura. No se altera su configuración, mantenimiento, datos, credenciales o contenedores.

## AUD-04

Descripción exacta original: **«El procedimiento de restore incluido no quedó verificado en aislamiento.»** Criterio exacto: **«Ruta operativa del producto probada, claves custodiadas y RPO/RTO medidos.»** La causa original era el transporte/puerto local fijo; P1 añadió el perfil explícito y probó los servicios del producto. Esta fase ejecutó además su CLI oficial, mantenimiento/drenaje sintético, cifrado/manifest y recuperación de la clave de prueba por procesos nuevos.

| Condición original | Verificado | Pendiente | Estado |
|---|---|---|---|
| Ruta operativa probada | CLI create/restore en DB/bucket nuevos; 23 tablas, 80 objetos, referencias, dinero, sesiones y autorización | Entorno operativo final sigue fuera del ensayo local | PASS LOCAL |
| Claves custodiadas | Clave sintética separada del backup y recuperada por procesos nuevos | Custodio/suplente, medio independiente del host, ACL revisada y recuperación de clave operativa | NO ACREDITADO para cierre |
| RPO/RTO medidos | Backup 3,535 s; restore CLI 7,968 s; comprobación de acceso 8,515 s desde invocar restore; antigüedad de última venta sintética identificada | Objetivos aceptados, cadencia/entorno/carga representativos y ensayo operativo | PARCIAL LOCAL; NO ACREDITADO productivamente |

**AUD-04: PARCIAL.** No se marca resuelto por un resultado técnico aislado ni se inventa aceptación manual. Matriz completa y evidencias: [01-aud04-acceptance.md](01-aud04-acceptance.md).

## MinIO e incidente

- Se conserva la atribución operativa documentada en P1: prueba heredada con Compose/force-recreate sobre el servicio habitual. Se corroboran código histórico, resultados de pruebas, contenedor recreado y volumen persistente anterior. No hay evidencia completa para fijar el último comando al milisegundo, número de recreaciones, duración de la interrupción ni ausencia absoluta de escrituras durante ella.
- Contenedor habitual: communicate-pos-minio-1; volumen communicate-pos_evidence_data montado en /data, creado antes del incidente. Bucket operativo creado antes de la recreación; dos objetos conservan fecha del 18/10.
- Cuatro archivos operativos del inventario inicial: accesibles con autorización, HEAD anónimo 403, cuatro tamaños/SHA-256 coincidentes. Esta comprobación no certifica los otros buckets ni la identidad de las personas fotografiadas.
- Inventario inicial (17:01 UTC) por metadata: **31 buckets, 87 objetos, 4.097.981 bytes**. Operativo inicial: **4 objetos, 1.544.180 bytes**. Cierre (17:20 UTC): **31 buckets, 89 objetos, 5.331.621 bytes**; operativo: **6 objetos, 2.777.820 bytes**. Otros 30 buckets: 83 objetos; muchos nombres/extensiones sugieren pruebas, backup/restore. Su propiedad/retención requiere catálogo, no limpieza automática.
- Diferencias explicadas: el IMEI adicional coincide con una fila/evento IMEI_CREATE del 20/10 15:51:57 UTC; los dos assets/documentos adicionales coinciden con creación y auditoría documental del 20/10 16:10:44 UTC. Se establece el tipo de operación registrado, no una atribución humana no demostrada.
- Cuatro archivos físicos frente a seis referencias activas no es pérdida: dos enlaces RECO más cuatro documentos cliente. Dos assets se comparten entre ficha y trámite; otros dos sólo tienen documento cliente.
- Discrepancias actuales del bucket operativo: **0 objetos desconocidos, 0 READY sin objeto, 0 assets sin referencias, 0 estados pendientes o de limpieza observados**. No se clasifica como huérfanos a los 83 objetos de otras bases/contextos.
- Prevención adicional: la imagen MinIO hereda etiquetas Compose del proyecto habitual. En esta fase se sobrescriben proyecto/servicio; el preflight valida nombres, propósito, puertos y mounts exclusivos. No se reconstruye ni modifica la imagen habitual.

Detalles y límites: [02-minio-incident.md](02-minio-incident.md), [03-storage-reconciliation.md](03-storage-reconciliation.md), evidence/baseline.json, storage-inventory.json y reconciliation-details.json.

## PostgreSQL e integridad

Inventario inicial: EvidenceAsset **4**, RegistrationEvidence **2**, ClientDocument **4**, referencias activas **6**. Al cierre: **6 / 2 / 6 / 8**, respectivamente; los seis documentos son CURRENT/vigentes. Los dos nuevos sólo se verificaron por metadatos, presencia y tamaño: no se descargaron ni se cotejó su SHA-256. Se comprobaron 34 FK validadas, cinco grupos de relaciones sin huérfanos, ownerClientId y categorías lógicas coherentes. La categoría física genérica IDENTITY_IMAGE no se confunde con el lado lógico del documento.

Conteos comerciales iniciales: 603 clientes, 641 equipos, 644 IMEI, 576 ventas y 118 RECO; al cierre hay 604 clientes y los otros cuatro conteos permanecen iguales. Las diferencias respecto de la auditoría original se concilian con registros posteriores, sin alterar datos para forzar igualdad.

Las comparaciones previas de 17:15–17:17 UTC coincidían con el inventario inicial. El POS siguió activo: a las 17:18:33 se registraron dos documentos nuevos CODART_DNIVEL con auditoría de subida concordante; también se observa un cliente adicional y CLIENT_CREATED. No se atribuye esa actividad a una persona. Los cuatro assets iniciales conservan estado/updatedAt y metadata física al cierre. CreatedAt, StartedAt y mounts de ambos contenedores habituales permanecen iguales: **no se reiniciaron en esta fase**. Los guiones de esta fase no escribieron datos comerciales ni eliminaron objetos/volúmenes; no se afirma que el POS activo no recibiera otras escrituras. Se limita esta conclusión a lo medido; no se afirma un hash completo de todas las filas históricas. Evidencia: final-state.json.

## Backup/restore

Procedimiento oficial: scripts/backup.ts, createBackup/restoreBackup/verifyBackup. Se ejecutó en servicios y dos volúmenes nuevos, en 55436/59030, con credenciales sintéticas y sin proveedores reales. Se probó mantenimiento, cierre del API sintético y espera de 125 segundos; no se pausó el POS habitual.

Respaldo cifrado sintético: 1.000 clientes, 80 IMEI, 20 ventas/S/ 2.005,00, 40 assets, 80 enlaces RECO y 40 documentos. El manifest contiene **80 objetos: 40 finales y 40 staging**, recuperados y cotejados en origen/destino. Las 23 tablas coinciden antes de los pasos posteriores de prueba, salvo sesiones/counters deliberadamente revocados. Acceso autorizado pasa; anónimo, cookie antigua y SELLER sin permiso son rechazados. Las secuencias continúan y el destino existente no se sobrescribe.

Clave incorrecta y manifest alterado se rechazan antes de crear destinos. No se destruye el archivo válido ni se usa una restauración manual alternativa. Los recursos/archivos sintéticos se conservan detenidos para inspección.

Resultado técnico consolidado: PASS LOCAL. Hubo dos detenciones del guion de verificación: nombre de bucket demasiado largo en el primer intento y expectativa incorrecta de 40 objetos en el último control del segundo. Se conservan los códigos 1 y los artefactos. La CLI válida de restore del segundo intento sí devolvió 0 y sus 18 controles pasaron; el último control se concluyó mediante lectura enfocada de los 80 objetos del manifest, sin otro ciclo de backup/restore. No se suman intentos como pruebas nuevas ni se ocultan sus errores de configuración/expectativa.

Mediciones, metodología y límites: [04-backup-restore.md](04-backup-restore.md), official-cli-drill-attempt1/2, official-cli-final-verification.json y cli-focused-verification.log. Backup externo, restore productivo, custodia independiente, automatización y alertas siguen NOT VERIFIED.

## Verificación de esta fase

| Grupo | Aprobado | Fallido / pendiente | Interpretación |
|---|---|---|---|
| Unitarias relacionadas de recuperación/guardas | 32/32 | 0 / 0 | Casos existentes reejecutados; no 32 pruebas nuevas añadidas a las 770 |
| Controles consolidados de CLI/restore y conclusión enfocada | 19 | 0 sin resolver técnicamente | No una ejecución continua perfecta: se preservan dos salidas iniciales 1 y su diagnóstico; no se cuentan los pasos repetidos dos veces |
| Integridad comercial observada | 4/4 iniciales SHA-256/tamaño; 2 nuevos sólo metadata/tamaño; matriz relacional coherente | Sin discrepancias materiales observadas en bucket operativo | Cuatro objetos iniciales comprobados en memoria en cada inventario; comparación final por metadata, sin descarga masiva |
| Scripts nuevos de orquestación | node --check y ejecución real con preflight | 0 errores sintácticos observados | Guiones exclusivos del ensayo, sin código comercial modificado |
| Aceptación operativa AUD-04 | Ruta local verificada | Custodia/objetivos/ensayo representativo pendientes | No sustituir por propuestas o métricas locales |
| Infraestructura/proveedores/hardware reales | No se ensayaron | AUD-05 y gates externos abiertos | No se consumen créditos ni se crean recursos cloud |

La primera comparación final de fechas físicas necesitó normalizar el método: HEAD representa LastModified sin fracciones, LIST conserva milisegundos. La comprobación temporal se mantiene comparando LIST contra LIST y el tamaño con HEAD. No se atribuye aquella falsa discrepancia a una escritura real.

No se ejecutó de nuevo la auditoría integral ni la suite de 770 casos. No hubo cambios de producto que justificasen repetirla. El código comercial, diseño y formatos de ticket **58/80 mm** permanecen iguales.

## Auditoría general y entrega

AUD-01/02/03: cierre local de P1 conservado, sin recertificación global nueva. AUD-04: PARCIAL. AUD-05: BLOQUEADO EXTERNO. P2 abiertos: AUD-06–10; P3 abierto: AUD-11. No se implementa ninguna corrección P2.

Se crean los informes 00–05 de esta carpeta y evidencia anonimizada/reproducible. Se actualiza la guía Phase9 con preflight/etiquetas/profile y la auditoría previa únicamente con resultados nuevos confirmados. Listado exacto en evidence/changed-files.txt. Los guiones operan en destinos explícitos y sus fuentes se incluyen sin variables privadas. Los archivos .env/clave/respaldos permanecen ignorados; no se versionan.

Push: **NO**. Deploy: **NO**. Sin cambios comerciales, credenciales reales, eliminación de contenedores/volúmenes/buckets, limpieza destructiva o migraciones comerciales. Los dos contenedores propios se detienen tras comprobar sus etiquetas; sus volúmenes se conservan.

## Siguiente fase

Completar la lista breve de [05-pending-actions.md](05-pending-actions.md): custodia real, aceptación/ensayo de RPO/RTO y responsables/retención. No declarar superado el gate de AUD-04 antes de ello ni iniciar P2 en esta fase. Un responsable puede decidir por separado trabajo P2 local en paralelo manteniendo explícitamente los gates pendientes; esa autorización no se infiere.

**NO PRODUCTION READY.** Integridad local y restore técnico aprobados no sustituyen aceptación operativa ni infraestructura acreditada.
